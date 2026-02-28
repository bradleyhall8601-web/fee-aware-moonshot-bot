import { DexPair } from "../positions/types.js";
import { config } from "../config.js";

export interface FilterResult {
  pass: boolean;
  reasons: string[];
}

/**
 * Compute pair age in hours from pairCreatedAt (unix ms timestamp).
 */
export function pairAgeHours(pairCreatedAt: number | undefined): number {
  if (!pairCreatedAt) return Infinity;
  return (Date.now() - pairCreatedAt) / (1000 * 60 * 60);
}

/**
 * Pick the best available txn window data (prefer m5 > h1 > h24).
 */
export function bestTxns(pair: DexPair): { buys: number; sells: number; total: number } {
  const window = pair.txns?.m5 ?? pair.txns?.h1 ?? pair.txns?.h24;
  if (!window) return { buys: 0, sells: 0, total: 0 };
  return {
    buys: window.buys,
    sells: window.sells,
    total: window.buys + window.sells,
  };
}

/**
 * Pick the best available volume (prefer h1 > h24 > m5).
 */
export function bestVolume(pair: DexPair): number {
  return pair.volume?.h1 ?? pair.volume?.h24 ?? pair.volume?.m5 ?? 0;
}

/**
 * Apply the Protected Moonshot Ladder filter to a pair.
 * Returns a FilterResult with detailed rejection reasons.
 */
export function applyMoonshotFilter(pair: DexPair): FilterResult {
  const reasons: string[] = [];

  // 1. Liquidity gate
  const liquidity = pair.liquidity?.usd ?? 0;
  if (liquidity < config.MIN_LIQUIDITY_USD) {
    reasons.push(
      `liquidity $${liquidity.toFixed(0)} < min $${config.MIN_LIQUIDITY_USD}`
    );
  }

  // 2. Pair age gate
  const ageHours = pairAgeHours(pair.pairCreatedAt);
  if (ageHours > config.MAX_PAIR_AGE_HOURS) {
    reasons.push(
      `pair age ${ageHours.toFixed(1)}h > max ${config.MAX_PAIR_AGE_HOURS}h`
    );
  }

  // 3. Volume gate
  const volume = bestVolume(pair);
  if (volume < config.MIN_VOLUME_USD) {
    reasons.push(
      `volume $${volume.toFixed(0)} < min $${config.MIN_VOLUME_USD}`
    );
  }
  if (volume > config.MAX_VOLUME_USD) {
    reasons.push(
      `volume $${volume.toFixed(0)} > max $${config.MAX_VOLUME_USD}`
    );
  }

  // 4. Txn count gate
  const txns = bestTxns(pair);
  if (txns.total < config.MIN_TXNS) {
    reasons.push(`txns ${txns.total} < min ${config.MIN_TXNS}`);
  }
  if (txns.total > config.MAX_TXNS) {
    reasons.push(`txns ${txns.total} > max ${config.MAX_TXNS}`);
  }

  // 5. Buy count gate
  if (txns.buys < config.MIN_BUYS) {
    reasons.push(`buys ${txns.buys} < min ${config.MIN_BUYS}`);
  }
  if (txns.buys > config.MAX_BUYS) {
    reasons.push(`buys ${txns.buys} > max ${config.MAX_BUYS}`);
  }

  // 6. Sell count gate
  if (txns.sells < config.MIN_SELLS) {
    reasons.push(`sells ${txns.sells} < min ${config.MIN_SELLS}`);
  }
  if (txns.sells > config.MAX_SELLS) {
    reasons.push(`sells ${txns.sells} > max ${config.MAX_SELLS}`);
  }

  // 7. Momentum gate: 5m price must be positive
  if (config.REQUIRE_5M_PRICE_UP) {
    const change5m = pair.priceChange?.m5 ?? -Infinity;
    if (change5m <= 0) {
      reasons.push(`5m price change ${change5m}% <= 0`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}

/**
 * Sort a list of pairs by descending momentum (total txns in best window).
 */
export function rankByMomentum(pairs: DexPair[]): DexPair[] {
  return [...pairs].sort(
    (a, b) => bestTxns(b).total - bestTxns(a).total
  );
}
