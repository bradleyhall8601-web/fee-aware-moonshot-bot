import { env } from "./env";

export const config = {
  enableLiveTrading: env.ENABLE_LIVE_TRADING,
  dryRun: env.DRY_RUN,
  pollIntervalMs: env.POLL_INTERVAL_MS,
  watchlistMints: env.WATCHLIST_MINTS,
  minLiquidityUsd: env.MIN_LIQUIDITY_USDC,
  minVolume1hUsd: env.MIN_VOLUME_1H,
  maxVolume1hUsd: env.MAX_VOLUME_1H,
  maxPriceImpactPct: env.MAX_PRICE_IMPACT_PCT,
  slippageBps: env.SLIPPAGE_BPS,
  profitTargetPct: env.PROFIT_TARGET_PCT,
  trailingStopPct: env.TRAILING_STOP_PCT,
  maxMomentumFailCount: env.MAX_MOMENTUM_FAIL_COUNT,
  maxConcurrentPositions: env.MAX_CONCURRENT_POSITIONS,
  walletSpendCapUsd: env.WALLET_SPEND_CAP_USD,
  sizingLadder: env.SIZING_LADDER,
  networkFeeUsdEstimate: env.NETWORK_FEE_USD_ESTIMATE,
  solPriceUsdEstimate: env.SOL_PRICE_USD_ESTIMATE
};

export type AppConfig = typeof config;
