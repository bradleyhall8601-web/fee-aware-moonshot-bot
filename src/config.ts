import { env } from "./env";

export const config = {
  enableLiveTrading: env.ENABLE_LIVE_TRADING,
  dryRun: env.DRY_RUN,
  pollIntervalMs: env.POLL_INTERVAL_MS,
  watchlistMints: env.WATCHLIST_MINTS,
  minLiquidityUsd: env.MIN_LIQUIDITY_USD,
  minVolumeM5Usd: env.MIN_VOLUME_M5_USD,
  maxVolumeM5Usd: env.MAX_VOLUME_M5_USD,
  maxFdvUsd: env.MAX_FDV_USD,
  maxPairAgeHours: env.MAX_PAIR_AGE_HOURS,
  maxSeenPairs: env.MAX_SEEN_PAIRS,
  requirePriceUpM5: env.REQUIRE_PRICE_UP_M5,
  minTxnsM5: env.MIN_TXNS_M5,
  maxTxnsM5: env.MAX_TXNS_M5,
  minBuysM5: env.MIN_BUYS_M5,
  maxBuysM5: env.MAX_BUYS_M5,
  minSellsM5: env.MIN_SELLS_M5,
  maxSellsM5: env.MAX_SELLS_M5,
  minLiquidityToFdvRatio: env.MIN_LIQUIDITY_TO_FDV_RATIO,
  maxSellsToBuysRatio: env.MAX_SELLS_TO_BUYS_RATIO,
  maxPriceImpactPct: env.MAX_PRICE_IMPACT_PCT,
  slippageBps: env.SLIPPAGE_BPS,
  profitTargetPct: env.PROFIT_TARGET_PCT,
  trailingStopPct: env.TRAILING_STOP_PCT,
  maxMomentumFailCount: env.MAX_MOMENTUM_FAIL_COUNT,
  maxConcurrentPositions: env.MAX_CONCURRENT_POSITIONS,
  walletSpendCapUsd: env.WALLET_SPEND_CAP_USD,
  sizingLadder: env.SIZING_LADDER,
  networkFeeUsdEstimate: env.NETWORK_FEE_USD_ESTIMATE,
  solUsdFallback: env.SOL_USD_FALLBACK
};

export type AppConfig = typeof config;
