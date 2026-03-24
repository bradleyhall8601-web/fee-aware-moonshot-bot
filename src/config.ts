import * as dotenv from "dotenv";
dotenv.config();

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  // ── Safety guard – NEVER flip to true in this bot ──────────────────────────
  enableLiveTrading: false as const,

  // ── RPC / API endpoints ─────────────────────────────────────────────────────
  HELIUS_RPC_URL: envStr(
    "HELIUS_RPC_URL",
    "https://api.mainnet-beta.solana.com"
  ),
  HELIUS_API_KEY: envStr("HELIUS_API_KEY", ""),
  DEXSCREENER_BASE_URL: envStr(
    "DEXSCREENER_BASE_URL",
    "https://api.dexscreener.com"
  ),
  COINGECKO_BASE_URL: envStr(
    "COINGECKO_BASE_URL",
    "https://api.coingecko.com/api/v3"
  ),
  RUGCHECK_BASE_URL: envStr(
    "RUGCHECK_BASE_URL",
    "https://api.rugcheck.xyz/v1"
  ),

  // ── Telegram ────────────────────────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: envStr("TELEGRAM_BOT_TOKEN", ""),

  // ── Paper-trading capital ───────────────────────────────────────────────────
  SIM_START_BALANCE_USD: envNum("SIM_START_BALANCE_USD", 1000),
  MAX_POSITION_USD: envNum("MAX_POSITION_USD", 200),
  MAX_BUY_USD: envNum("MAX_BUY_USD", 100),

  // ── Filter thresholds ───────────────────────────────────────────────────────
  MIN_LIQUIDITY_USD: envNum("MIN_LIQUIDITY_USD", 7500),
  MIN_VOLUME_USD: envNum("MIN_VOLUME_USD", 500),
  MIN_BUY_SELL_RATIO: envNum("MIN_BUY_SELL_RATIO", 1.05),

  // ── Exit parameters ─────────────────────────────────────────────────────────
  TAKE_PROFIT_PCT: envNum("TAKE_PROFIT_PCT", 30),
  TRAILING_STOP_PCT: envNum("TRAILING_STOP_PCT", 15),
  /** @deprecated Use TAKE_PROFIT_PCT – kept for debug.ts back-compat only */
  PROFIT_TARGET_PCT: envNum("TAKE_PROFIT_PCT", 30),

  // ── Poll interval ───────────────────────────────────────────────────────────
  POLL_INTERVAL_MS: envNum("POLL_INTERVAL_MS", 30_000),

  // ── Watch wallets (comma-separated) ────────────────────────────────────────
  WATCH_WALLETS: envStr("WATCH_WALLETS", ""),

  // ── Postgres (optional) ─────────────────────────────────────────────────────
  POSTGRES_URL: envStr("POSTGRES_URL", ""),

  // ── Logging ─────────────────────────────────────────────────────────────────
  LOG_LEVEL: envStr("LOG_LEVEL", "info"),

  // ── Legacy / debug.ts fields ────────────────────────────────────────────────
  MIN_BUY_USD_MODE: envStr("MIN_BUY_USD_MODE", "fixed"),
  MIN_BUY_USD_BASE: envNum("MAX_BUY_USD", 100),
  MIN_BUY_USD_MIN: envNum("MIN_BUY_USD_MIN", 10),
  MAX_LIQUIDITY_DROP_PCT: envNum("MAX_LIQUIDITY_DROP_PCT", 20),
  MIN_VOLUME_USD_24H: envNum("MIN_VOLUME_USD", 500),
  MIN_TXNS_5M: envNum("MIN_TXNS_5M", 5),
  SLIPPAGE_BPS_BUFFER: envNum("SLIPPAGE_BPS_BUFFER", 100),
  PLATFORM_FEE_BPS_ESTIMATE: envNum("PLATFORM_FEE_BPS_ESTIMATE", 30),
  NETWORK_FEE_USD_ESTIMATE: envNum("NETWORK_FEE_USD_ESTIMATE", 0.01),
  GAS_EMERGENCY_SOL: envNum("GAS_EMERGENCY_SOL", 0.05),

  // ── Legacy filter config (kept for back-compat) ─────────────────────────────
  minLiquidityUsd: envNum("MIN_LIQUIDITY_USD", 7500),
  maxPoolAgeMs: 48 * 60 * 60 * 1000,
  preferWindow: "m5",
  minTxns: 15,
  maxTxns: 1200,
  minBuys: 8,
  maxSells: 650,
  minBuySellRatio: envNum("MIN_BUY_SELL_RATIO", 1.05),
  minVolumeUsd: envNum("MIN_VOLUME_USD", 500),
  maxVolumeUsd: 400_000,
  allowedDexIds: ["raydium", "orca", "meteora"],
  allowedQuoteSymbols: ["SOL", "USDC", "USDT"],
  failClosed: true,
};