import "dotenv/config";
import { z } from "zod";

const boolStr = z
  .string()
  .toLowerCase()
  .transform((v) => v === "true")
  .pipe(z.boolean());

const numStr = (def: number) =>
  z
    .string()
    .default(String(def))
    .transform((v) => Number(v))
    .pipe(z.number());

const optNumStr = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined));

const envSchema = z.object({
  // Infrastructure
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  WALLET_PRIVATE_KEY: z.string().optional(),
  ENABLE_LIVE_TRADING: boolStr.default("false"),
  ENABLE_KILL_SWITCH: boolStr.default("false"),

  // API endpoints
  QUOTE_API_BASE: z.string().url().default("https://api.jup.ag/swap/v1"),
  DEXSCREENER_BASE: z.string().url().default("https://api.dexscreener.com"),

  // Input mint (default: wSOL)
  INPUT_MINT: z
    .string()
    .default("So11111111111111111111111111111111111111112"),

  // Discovery
  WATCHLIST_MINTS: z.string().optional(),

  // Trade sizing
  POSITION_SIZE_SOL: numStr(0.05),
  MAX_OPEN_POSITIONS: numStr(2),

  // Filters
  MIN_LIQUIDITY_USD: numStr(10000),
  MAX_PAIR_AGE_HOURS: numStr(24),
  MIN_TXNS: numStr(100),
  MAX_TXNS: numStr(1000),
  MIN_BUYS: numStr(100),
  MAX_BUYS: numStr(1000),
  MIN_SELLS: numStr(1),
  MAX_SELLS: numStr(100),
  MIN_VOLUME_USD: numStr(1000),
  MAX_VOLUME_USD: numStr(100000),
  REQUIRE_5M_PRICE_UP: boolStr.default("true"),

  // Swap
  SLIPPAGE_BPS: numStr(150),
  PRIORITY_FEE_MICRO_LAMPORTS: optNumStr(),

  // Exit thresholds
  STOP_LOSS_PCT: numStr(18),
  TAKE_PROFIT_LOCK_PCT: numStr(30),
  TAKE_PROFIT_LOCK_SELL_PCT: numStr(50),
  RUNNER_TRAIL_STOP_PCT: numStr(12),
  MOMENTUM_EXIT_IF_5M_RED: boolStr.default("true"),

  // Rate limiting & polling
  DEXSCREENER_RATE_LIMIT_RPM: numStr(240),
  POLL_INTERVAL_SECONDS: numStr(20),

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment configuration:\n",
    parsed.error.format()
  );
  process.exit(1);
}

export const config = parsed.data;

export type Config = typeof config;
