export const config = {
  minLiquidityUsd: 7500,
  maxPoolAgeMs: 48 * 60 * 60 * 1000, // 48 hours
  preferWindow: "m5",
  minTxns: 15,
  maxTxns: 1200,
  minBuys: 8,
  maxSells: 650,
  minBuySellRatio: 1.05,
  minVolumeUsd: 500,
  maxVolumeUsd: 400000,
  allowedDexIds: ["raydium", "orca", "meteora"],
  allowedQuoteSymbols: ["SOL", "USDC", "USDT"],
  failClosed: true
};