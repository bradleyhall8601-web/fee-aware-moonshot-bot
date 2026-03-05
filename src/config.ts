import dotenv from "dotenv";

dotenv.config();

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  enableLiveTrading: process.env.ENABLE_LIVE_TRADING === "true",
  pollIntervalMs: parseNumber(process.env.POLL_INTERVAL_MS, 10_000),
  watchlistMints: (process.env.WATCHLIST_MINTS ?? "")
    .split(",")
    .map((mint) => mint.trim())
    .filter(Boolean),
  minLiquidityUsd: parseNumber(process.env.MIN_LIQUIDITY_USDC, 10_000),
  minVolume1hUsd: parseNumber(process.env.MIN_VOLUME_1H, 1_000),
  maxVolume1hUsd: parseNumber(process.env.MAX_VOLUME_1H, 100_000),
  profitTargetPct: parseNumber(process.env.PROFIT_TARGET_PCT, 30),
  trailingStopPct: parseNumber(process.env.TRAILING_STOP_PCT, 15)
};

export type AppConfig = typeof config;
