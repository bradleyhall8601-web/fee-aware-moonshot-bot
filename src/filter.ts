import { DexPair } from './types';
import { env } from './env';
import { config } from './config';

/**
 * Returns true when a DexScreener pair meets all screening criteria.
 * Uses the h1 txn window for buy/sell counts and volume.
 */
export function passesFilter(pair: DexPair): boolean {
  const now = Date.now();

  // Chain must be Solana
  if (pair.chainId !== 'solana') return false;

  // DEX whitelist
  if (!config.allowedDexIds.includes(pair.dexId)) return false;

  // Quote token whitelist
  if (!config.allowedQuoteSymbols.includes(pair.quoteToken.symbol)) return false;

  // Liquidity
  const liqUsd = pair.liquidity?.usd ?? 0;
  if (liqUsd < env.MIN_LIQUIDITY_USDC) return false;

  // Volume (1h window)
  const vol1h = pair.volume?.h1 ?? 0;
  if (vol1h < env.MIN_VOLUME_1H || vol1h > env.MAX_VOLUME_1H) return false;

  // FDV cap
  if (pair.fdv !== undefined && pair.fdv > env.MAX_FDV_RATIO) return false;

  // Token / pool age
  const ageMs = now - (pair.pairCreatedAt ?? 0);
  if (ageMs > config.maxPoolAgeMs) return false;

  // Minimum 5-min price change momentum
  if ((pair.priceChange?.m5 ?? 0) < env.MIN_PRICE_CHANGE_5M) return false;

  // Txn counts (h1 window)
  const txns = pair.txns?.h1 ?? { buys: 0, sells: 0 };
  const total = txns.buys + txns.sells;

  if (total < env.MIN_TXNS || total > env.MAX_TXNS) return false;
  if (txns.buys < env.MIN_BUYS || txns.buys > env.MAX_BUYS) return false;
  if (txns.sells < env.MIN_SELLS || txns.sells > env.MAX_SELLS) return false;

  // Buy-to-sell ratio
  if (txns.sells > 0 && txns.buys / txns.sells < config.minBuySellRatio) return false;

  return true;
}
