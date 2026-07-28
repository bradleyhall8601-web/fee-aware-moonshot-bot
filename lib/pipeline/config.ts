import { env } from '../env';
import { supabaseAdmin } from '../supabase-admin';
import type { StrategyConfig, StrategyName } from './types';

const NAMES: StrategyName[] = ['SNIPER', 'SCALP', 'RIDE'];

function fallback(strategy: StrategyName): StrategyConfig {
  const e = env();
  const defaults = {
    SNIPER: { minScore: e.SNIPER_MIN_SCORE, stopLossPct: -5, takeProfitPct: 18, trailActivatePct: 8, trailingPct: 4, maxHoldMinutes: 8 },
    SCALP: { minScore: e.SCALP_MIN_SCORE, stopLossPct: -4, takeProfitPct: 12, trailActivatePct: 7, trailingPct: 3, maxHoldMinutes: 25 },
    RIDE: { minScore: e.RIDE_MIN_SCORE, stopLossPct: -8, takeProfitPct: 35, trailActivatePct: 15, trailingPct: 8, maxHoldMinutes: 360 },
  }[strategy];
  return {
    strategy,
    ...defaults,
    paperNotionalUsd: e.DEFAULT_PAPER_NOTIONAL_USD,
    maxDailyEntries: e.MAX_DAILY_ENTRIES,
    maxDailyEntriesPerMint: e.MAX_DAILY_ENTRIES_PER_MINT,
  };
}

export async function loadStrategyConfigs(): Promise<Record<StrategyName, StrategyConfig>> {
  const db = supabaseAdmin();
  const { data, error } = await db.from('strategy_config').select('*');
  if (error) throw new Error(`strategy_config unavailable: ${error.message}`);
  const result = Object.fromEntries(NAMES.map(name => [name, fallback(name)])) as Record<StrategyName, StrategyConfig>;
  for (const row of data ?? []) {
    const strategy = String(row.strategy) as StrategyName;
    if (!NAMES.includes(strategy)) continue;
    result[strategy] = {
      strategy,
      minScore: Number(row.min_score),
      paperNotionalUsd: Number(row.paper_notional_usd),
      stopLossPct: Number(row.stop_loss_pct),
      takeProfitPct: Number(row.take_profit_pct),
      trailActivatePct: Number(row.trail_activate_pct),
      trailingPct: Number(row.trailing_pct),
      maxHoldMinutes: Number(row.max_hold_minutes),
      maxDailyEntries: Number(row.max_daily_entries),
      maxDailyEntriesPerMint: Number(row.max_daily_entries_per_mint),
    };
  }
  return result;
}
