import { assertPaperOnly, env } from '../env';
import { runId } from '../ids';
import { discoverCandidates, fetchPricesByMint } from '../market/dexscreener';
import { logActivity, supabaseAdmin } from '../supabase-admin';
import { notifyPositionClose, notifySignal } from '../telegram';
import { enrichSafety } from './safety';
import { evaluateCandidate } from './scoring';
import { loadStrategyConfigs } from './config';
import type { CandidateEvaluation, StrategyConfig, StrategyName } from './types';

async function startRun(jobName: string): Promise<{ runId: string; claimed: boolean }> {
  const id = runId(jobName);
  const db = supabaseAdmin();
  const { data, error } = await db.rpc('claim_job', {
    p_job_name: jobName,
    p_run_id: id,
    p_ttl_seconds: 180,
  });
  if (error) throw error;
  const claimed = Boolean(data);
  if (claimed) {
    const { error: insertError } = await db.from('job_runs').insert({ id, job_name: jobName, status: 'running' });
    if (insertError) throw insertError;
  }
  return { runId: id, claimed };
}

async function finishRun(id: string, jobName: string, status: 'success' | 'failed', summary: Record<string, unknown>): Promise<void> {
  const db = supabaseAdmin();
  await Promise.all([
    db.from('job_runs').update({ status, finished_at: new Date().toISOString(), summary }).eq('id', id),
    db.rpc('release_job', { p_job_name: jobName, p_run_id: id }),
  ]);
}

async function persistEvaluation(
  evaluation: CandidateEvaluation,
  config: StrategyConfig,
): Promise<{ created: boolean; reason: string }> {
  const db = supabaseAdmin();
  const c = evaluation.candidate;
  const { error: candidateError } = await db.from('candidates').upsert({
    candidate_id: evaluation.candidateId,
    observed_at: evaluation.observedAt,
    mint: c.mint,
    pair_address: c.pairAddress,
    symbol: c.symbol,
    name: c.name,
    dex_id: c.dexId,
    price_usd: c.priceUsd,
    liquidity_usd: c.liquidityUsd,
    volume_5m_usd: c.volume5mUsd,
    volume_1h_usd: c.volume1hUsd,
    pool_age_ms: c.poolAgeMs,
    valid: evaluation.valid,
    winning_strategy: evaluation.winner?.strategy ?? null,
    winning_score: evaluation.winner?.score ?? null,
    rejection_codes: evaluation.rejectionCodes,
    raw_market: c.raw,
    safety: evaluation.safety,
    source: c.source,
  });
  if (candidateError) throw candidateError;

  const scoreRows = evaluation.scores.map(score => ({
    candidate_id: evaluation.candidateId,
    strategy: score.strategy,
    score: score.score,
    threshold: score.threshold,
    qualified: score.qualified,
    incomplete: score.incomplete,
    missing_fields: score.missing,
    rejection_codes: score.rejectionCodes,
    components: score.components,
    score_version: score.version,
    scored_at: evaluation.observedAt,
  }));
  const { error: scoresError } = await db.from('strategy_scores').upsert(scoreRows, { onConflict: 'candidate_id,strategy' });
  if (scoresError) throw scoresError;

  if (!evaluation.winner) return { created: false, reason: 'no_qualified_strategy' };
  const { data, error } = await db.rpc('create_signal_and_position', {
    p_signal_id: evaluation.signalId,
    p_candidate_id: evaluation.candidateId,
    p_strategy: evaluation.winner.strategy,
    p_score: evaluation.winner.score,
    p_symbol: c.symbol,
    p_name: c.name,
    p_mint: c.mint,
    p_pair_address: c.pairAddress,
    p_entry_price: c.priceUsd,
    p_notional_usd: config.paperNotionalUsd,
    p_max_open_positions: env().MAX_OPEN_POSITIONS,
    p_max_daily_entries: config.maxDailyEntries,
    p_max_daily_entries_per_mint: config.maxDailyEntriesPerMint,
  });
  if (error) throw error;
  const result = (data ?? {}) as { created?: boolean; reason?: string };
  return { created: Boolean(result.created), reason: String(result.reason ?? 'unknown') };
}

export async function runScanJob(): Promise<Record<string, unknown>> {
  assertPaperOnly();
  const jobName = 'candidate_scan';
  const started = await startRun(jobName);
  if (!started.claimed) return { ok: true, skipped: true, reason: 'job_already_running' };

  const summary = { discovered: 0, evaluated: 0, valid: 0, signalsCreated: 0, errors: 0 };
  try {
    const [candidates, configs] = await Promise.all([discoverCandidates(35), loadStrategyConfigs()]);
    summary.discovered = candidates.length;

    // Limit expensive safety enrichment per run. Candidate discovery remains fully persisted over time.
    const batch = candidates.slice(0, 15);
    for (const candidate of batch) {
      try {
        const safety = await enrichSafety(candidate);
        const evaluation = evaluateCandidate(candidate, safety, {
          SNIPER: configs.SNIPER.minScore,
          SCALP: configs.SCALP.minScore,
          RIDE: configs.RIDE.minScore,
        });
        summary.evaluated++;
        if (evaluation.valid) summary.valid++;
        const winnerConfig = evaluation.winner ? configs[evaluation.winner.strategy] : configs.SCALP;
        const result = await persistEvaluation(evaluation, winnerConfig);
        if (result.created && evaluation.winner) {
          summary.signalsCreated++;
          await notifySignal({
            symbol: candidate.symbol,
            mint: candidate.mint,
            strategy: evaluation.winner.strategy,
            score: evaluation.winner.score,
            priceUsd: candidate.priceUsd,
            liquidityUsd: candidate.liquidityUsd,
          });
        }
      } catch (error) {
        summary.errors++;
        await logActivity({
          category: 'scanner',
          action: 'candidate_error',
          severity: 'error',
          actor: 'candidate-scan',
          payload: { mint: candidate.mint, error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    await logActivity({ category: 'job', action: 'candidate_scan_complete', actor: 'candidate-scan', payload: summary });
    await finishRun(started.runId, jobName, 'success', summary);
    return { ok: true, ...summary };
  } catch (error) {
    const failure = { ...summary, error: error instanceof Error ? error.message : String(error) };
    await logActivity({ category: 'job', action: 'candidate_scan_failed', severity: 'error', actor: 'candidate-scan', payload: failure });
    await finishRun(started.runId, jobName, 'failed', failure);
    throw error;
  }
}

function exitDecision(
  position: any,
  currentPrice: number,
  config: StrategyConfig,
): { close: boolean; reason?: string; pnlPct: number; highestPrice: number } {
  const entry = Number(position.entry_price);
  const previousHigh = Number(position.highest_price ?? entry);
  const highestPrice = Math.max(previousHigh, currentPrice);
  const pnlPct = entry > 0 ? ((currentPrice - entry) / entry) * 100 : 0;
  const drawdownFromHigh = highestPrice > 0 ? ((currentPrice - highestPrice) / highestPrice) * 100 : 0;
  const ageMs = Date.now() - new Date(position.opened_at).getTime();

  if (pnlPct <= config.stopLossPct) return { close: true, reason: 'STOP_LOSS', pnlPct, highestPrice };
  if (pnlPct >= config.takeProfitPct) return { close: true, reason: 'TAKE_PROFIT', pnlPct, highestPrice };
  if (pnlPct >= config.trailActivatePct && drawdownFromHigh <= -config.trailingPct) {
    return { close: true, reason: 'TRAILING_STOP', pnlPct, highestPrice };
  }
  if (ageMs >= config.maxHoldMinutes * 60_000) return { close: true, reason: 'MAX_HOLD', pnlPct, highestPrice };
  return { close: false, pnlPct, highestPrice };
}

export async function runPositionMonitorJob(): Promise<Record<string, unknown>> {
  assertPaperOnly();
  const jobName = 'position_monitor';
  const started = await startRun(jobName);
  if (!started.claimed) return { ok: true, skipped: true, reason: 'job_already_running' };

  const summary = { open: 0, repriced: 0, closed: 0, missingPrices: 0, errors: 0 };
  try {
    const db = supabaseAdmin();
    const configs = await loadStrategyConfigs();
    const { data: positions, error } = await db.from('paper_positions').select('*').eq('status', 'open').limit(100);
    if (error) throw error;
    summary.open = positions?.length ?? 0;
    const prices = await fetchPricesByMint((positions ?? []).map((row: any) => row.mint));

    for (const position of positions ?? []) {
      try {
        const price = prices.get(position.mint);
        if (!price) { summary.missingPrices++; continue; }
        const strategy = position.strategy as StrategyName;
        const config = configs[strategy] ?? configs.SCALP;
        const decision = exitDecision(position, price, config);
        summary.repriced++;
        if (!decision.close) {
          await db.from('paper_positions').update({
            current_price: price,
            highest_price: decision.highestPrice,
            pnl_pct: decision.pnlPct,
            pnl_usd: Number(position.notional_usd) * decision.pnlPct / 100,
            updated_at: new Date().toISOString(),
          }).eq('id', position.id).eq('status', 'open');
          continue;
        }

        const { data: closed, error: closeError } = await db.rpc('close_paper_position', {
          p_position_id: position.id,
          p_exit_price: price,
          p_exit_reason: decision.reason,
        });
        if (closeError) throw closeError;
        if (closed?.closed) {
          summary.closed++;
          await notifyPositionClose({
            symbol: position.symbol,
            strategy: position.strategy,
            pnlUsd: Number(closed.pnl_usd ?? 0),
            pnlPct: Number(closed.pnl_pct ?? 0),
            reason: String(decision.reason),
          });
        }
      } catch (positionError) {
        summary.errors++;
        await logActivity({
          category: 'positions',
          action: 'monitor_error',
          severity: 'error',
          actor: 'position-monitor',
          payload: { positionId: position.id, error: positionError instanceof Error ? positionError.message : String(positionError) },
        });
      }
    }

    await logActivity({ category: 'job', action: 'position_monitor_complete', actor: 'position-monitor', payload: summary });
    await finishRun(started.runId, jobName, 'success', summary);
    return { ok: true, ...summary };
  } catch (error) {
    const failure = { ...summary, error: error instanceof Error ? error.message : String(error) };
    await finishRun(started.runId, jobName, 'failed', failure);
    throw error;
  }
}
