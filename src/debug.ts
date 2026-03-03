import { loadState } from "./state";
import { config } from "./config";

export function dumpDebugState(): string {
  const s = loadState();
  return JSON.stringify(
    {
      config: {
        enableLiveTrading: config.enableLiveTrading,
        MIN_BUY_USD_MODE: config.MIN_BUY_USD_MODE,
        MIN_BUY_USD_BASE: config.MIN_BUY_USD_BASE,
        MIN_BUY_USD_MIN: config.MIN_BUY_USD_MIN,
        MIN_LIQUIDITY_USD: config.MIN_LIQUIDITY_USD,
        MAX_LIQUIDITY_DROP_PCT: config.MAX_LIQUIDITY_DROP_PCT,
        MIN_VOLUME_USD_24H: config.MIN_VOLUME_USD_24H,
        MIN_TXNS_5M: config.MIN_TXNS_5M,
        MIN_BUY_SELL_RATIO: config.MIN_BUY_SELL_RATIO,
        SLIPPAGE_BPS_BUFFER: config.SLIPPAGE_BPS_BUFFER,
        PLATFORM_FEE_BPS_ESTIMATE: config.PLATFORM_FEE_BPS_ESTIMATE,
        NETWORK_FEE_USD_ESTIMATE: config.NETWORK_FEE_USD_ESTIMATE,
        GAS_EMERGENCY_SOL: config.GAS_EMERGENCY_SOL,
        PROFIT_TARGET_PCT: config.PROFIT_TARGET_PCT,
        TRAILING_STOP_PCT: config.TRAILING_STOP_PCT,
        POLL_INTERVAL_MS: config.POLL_INTERVAL_MS
      },
      mode: s.lastMode,
      blockedReasons: s.lastEntryBlockedReasons,
      solBalance: s.solBalance,
      positions: s.positions,
      pnl: s.pnl,
      lastSeenLiquidityUsdByPool: s.lastSeenLiquidityUsdByPool,
      updatedAtMs: s.updatedAtMs
    },
    null,
    2
  );
}

export function printDebugState(): void {
  console.log(dumpDebugState());
}