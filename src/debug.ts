import { config } from "./config.js";
import State from "./state.js";

export function dumpDebugState(): string {
  return JSON.stringify(
    {
      config: {
        minLiquidityUsd: config.minLiquidityUsd,
        maxPoolAgeMs: config.maxPoolAgeMs,
        preferWindow: config.preferWindow,
        minTxns: config.minTxns,
        maxTxns: config.maxTxns,
        minBuys: config.minBuys,
        maxSells: config.maxSells,
        minBuySellRatio: config.minBuySellRatio,
        minVolumeUsd: config.minVolumeUsd,
        maxVolumeUsd: config.maxVolumeUsd,
        allowedDexIds: config.allowedDexIds,
        allowedQuoteSymbols: config.allowedQuoteSymbols,
        failClosed: config.failClosed,
      },
      state: {
        balances: State.balances,
        orders: State.orders,
      },
      updatedAtMs: new Date().getTime()
    },
    null,
    2
  );
}

export function printDebugState(): void {
  console.log(dumpDebugState());
}