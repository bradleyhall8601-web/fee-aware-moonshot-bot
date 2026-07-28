import { env } from '../env';
import { candidateId, signalId } from '../ids';
import { classifyToken } from '../token-classifier';
import { computeSniperScore } from '../strategies/sniper';
import { computeScalpScore } from '../strategies/scalp';
import { computeRideScore } from '../strategies/ride';
import type { CandidateEvaluation, MarketCandidate, SafetyEnrichment, StrategyEvaluation, StrategyName } from './types';

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function completeness(safety: SafetyEnrichment): number {
  const fields = [
    safety.mintAuthorityRevoked,
    safety.freezeAuthorityRevoked,
    safety.top1HolderPct,
    safety.top10HolderPct,
    safety.creatorSellPct,
    safety.routeAvailable,
    safety.priceImpactPct,
    safety.slippagePct,
  ];
  return fields.filter(value => value !== null && value !== undefined).length / fields.length;
}

function marketRegime(candidate: MarketCandidate): number {
  let score = 50;
  if (candidate.priceChange5m > 0) score += 10;
  if (candidate.priceChange1h > 0) score += 10;
  if (candidate.priceChange24h > 0) score += 8;
  if (candidate.buys5m > candidate.sells5m) score += 10;
  if (candidate.priceChange5m > 35) score -= 18;
  if (candidate.priceChange1h < -10) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function baseRejections(candidate: MarketCandidate, safety: SafetyEnrichment): string[] {
  const rejectionCodes: string[] = [];
  const classification = classifyToken(candidate.mint, candidate.symbol, candidate.name);
  if (!classification.allowed) rejectionCodes.push('REJECTED_TOKEN_CLASS');
  if (!candidate.liquidityUsd || candidate.liquidityUsd < 2_500) rejectionCodes.push('REJECTED_MISSING_LIQUIDITY');
  if (!candidate.volume5mUsd || candidate.volume5mUsd <= 0) rejectionCodes.push('REJECTED_MISSING_VOLUME');
  if (!candidate.poolAgeMs) rejectionCodes.push('REJECTED_MISSING_POOL_AGE');
  if (safety.routeAvailable === false) rejectionCodes.push('REJECTED_SELLABILITY');
  if (safety.priceImpactPct !== null && safety.priceImpactPct > 8) rejectionCodes.push('REJECTED_PRICE_IMPACT');
  if (safety.slippagePct !== null && safety.slippagePct > 8) rejectionCodes.push('REJECTED_SLIPPAGE');
  if (safety.top1HolderPct !== null && safety.top1HolderPct > 40) rejectionCodes.push('REJECTED_CONCENTRATION');
  if (!safety.providerHealthy) rejectionCodes.push('REJECTED_PROVIDER_DEGRADED');
  return [...new Set(rejectionCodes)];
}

function requiredMissing(strategy: StrategyName, safety: SafetyEnrichment): string[] {
  const required: Record<StrategyName, string[]> = {
    SNIPER: ['mintAuthorityRevoked', 'freezeAuthorityRevoked', 'top1HolderPct', 'top10HolderPct', 'creatorSellPct', 'routeAvailable', 'priceImpactPct'],
    SCALP: ['top1HolderPct', 'routeAvailable', 'priceImpactPct'],
    RIDE: ['top1HolderPct', 'routeAvailable', 'priceImpactPct'],
  };
  return required[strategy].filter(field => safety.missing.includes(field));
}

function finalize(
  strategy: StrategyName,
  result: { score: number; components: object; incomplete?: boolean; missing?: string[]; version: string },
  threshold: number,
  candidateRejections: string[],
  safety: SafetyEnrichment,
): StrategyEvaluation {
  const e = env();
  const missing = [...new Set([...(result.missing ?? []), ...requiredMissing(strategy, safety)])];
  const rejectionCodes = [...candidateRejections];
  if (missing.length && e.STRICT_DATA_GATE === 'true') rejectionCodes.push('REJECTED_INCOMPLETE_SCORE');
  if (result.score < threshold) rejectionCodes.push('REJECTED_SCORE_BELOW_THRESHOLD');
  const qualified = rejectionCodes.length === 0;
  return {
    strategy,
    score: finite(result.score),
    threshold,
    qualified,
    incomplete: Boolean(result.incomplete || missing.length),
    missing,
    rejectionCodes: [...new Set(rejectionCodes)],
    components: result.components as Record<string, number>,
    version: result.version,
  };
}

export function evaluateCandidate(
  candidate: MarketCandidate,
  safety: SafetyEnrichment,
  thresholds: Partial<Record<StrategyName, number>> = {},
  now = Date.now(),
): CandidateEvaluation {
  const e = env();
  const complete = completeness(safety);
  const priorFiveMinuteVolume = candidate.volume1hUsd > 0 ? candidate.volume1hUsd / 12 : null;
  const base = baseRejections(candidate, safety);
  const regime = marketRegime(candidate);

  const sniper = computeSniperScore({
    liquidityUsd: candidate.liquidityUsd,
    volume5mUsd: candidate.volume5mUsd,
    priceChange5m: candidate.priceChange5m,
    priceChange1h: candidate.priceChange1h,
    buyCount5m: candidate.buys5m,
    sellCount5m: candidate.sells5m,
    poolAgeMs: candidate.poolAgeMs,
    fieldsComplete: complete,
    mintAuthorityRevoked: safety.mintAuthorityRevoked,
    freezeAuthorityRevoked: safety.freezeAuthorityRevoked,
    top1HolderPct: safety.top1HolderPct,
    top10HolderPct: safety.top10HolderPct,
    creatorSellPct: safety.creatorSellPct,
    routeAvailable: safety.routeAvailable,
    priceImpactPct: safety.priceImpactPct,
    slippagePct: safety.slippagePct,
    providerHealthy: safety.providerHealthy,
  });

  const scalp = computeScalpScore({
    liquidityUsd: candidate.liquidityUsd,
    volume5mUsd: candidate.volume5mUsd,
    volume5mPrevUsd: priorFiveMinuteVolume,
    buyCount5m: candidate.buys5m,
    sellCount5m: candidate.sells5m,
    priceChange5m: candidate.priceChange5m,
    priceChange1h: candidate.priceChange1h,
    top1HolderPct: safety.top1HolderPct,
    routeAvailable: safety.routeAvailable,
    priceImpactPct: safety.priceImpactPct,
    slippagePct: safety.slippagePct,
    marketRegimeScore: regime,
    fieldsComplete: complete,
    isExhausted: candidate.priceChange5m > 35,
  });

  const ride = computeRideScore({
    liquidityUsd: candidate.liquidityUsd,
    volume5mUsd: candidate.volume5mUsd,
    volume5mPrevUsd: priorFiveMinuteVolume,
    buyCount5m: candidate.buys5m,
    sellCount5m: candidate.sells5m,
    poolAgeMs: candidate.poolAgeMs,
    priceChange5m: candidate.priceChange5m,
    priceChange1h: candidate.priceChange1h,
    priceChange24h: candidate.priceChange24h,
    top1HolderPct: safety.top1HolderPct,
    creatorDumpFlag: safety.creatorSellPct === null ? null : safety.creatorSellPct > 10,
    routeAvailable: safety.routeAvailable,
    priceImpactPct: safety.priceImpactPct,
    marketRegimeScore: regime,
    fieldsComplete: complete,
  });

  const scores: StrategyEvaluation[] = [
    finalize('SNIPER', sniper, thresholds.SNIPER ?? e.SNIPER_MIN_SCORE, base, safety),
    finalize('SCALP', scalp, thresholds.SCALP ?? e.SCALP_MIN_SCORE, base, safety),
    finalize('RIDE', ride, thresholds.RIDE ?? e.RIDE_MIN_SCORE, base, safety),
  ];
  const winner = scores.filter(score => score.qualified).sort((a, b) => b.score - a.score)[0] ?? null;
  const id = candidateId(candidate.mint, candidate.pairAddress, now);
  const rejections = winner ? [] : [...new Set(scores.flatMap(score => score.rejectionCodes))];

  return {
    candidateId: id,
    signalId: signalId(id, winner?.strategy ?? 'NONE'),
    candidate,
    safety,
    scores,
    winner,
    rejectionCodes: rejections,
    valid: Boolean(winner),
    observedAt: new Date(now).toISOString(),
  };
}
