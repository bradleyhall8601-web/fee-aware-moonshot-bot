import { env } from './env';

export const config = {
  // Static / structural limits
  allowedDexIds: ['raydium', 'orca', 'meteora'],
  allowedQuoteSymbols: ['SOL', 'USDC', 'USDT'],
  minBuySellRatio: 1.05,
  failClosed: true,

  // Dynamic limits driven by env vars
  get minLiquidityUsd() { return env.MIN_LIQUIDITY_USDC; },
  get maxPoolAgeMs() { return env.MAX_TOKEN_AGE_HOURS * 60 * 60 * 1000; },
  get minVolumeUsd() { return env.MIN_VOLUME_1H; },
  get maxVolumeUsd() { return env.MAX_VOLUME_1H; },
  get minTxns() { return env.MIN_TXNS; },
  get maxTxns() { return env.MAX_TXNS; },
  get minBuys() { return env.MIN_BUYS; },
  get maxSells() { return env.MAX_SELLS; },
};