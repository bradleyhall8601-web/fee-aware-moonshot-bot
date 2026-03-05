import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function ensureEnvFileExists(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    return;
  }

  const examplePath = path.resolve(process.cwd(), ".env.example");
  if (!fs.existsSync(examplePath)) {
    return;
  }

  fs.copyFileSync(examplePath, envPath);
}

ensureEnvFileExists();
dotenv.config();

function optionalStr(val: string | undefined): string | undefined {
  if (val === undefined) {
    return undefined;
  }
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = optionalStr(process.env[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function bool(keys: string[], def: boolean): boolean {
  const value = pickEnv(keys);
  if (value === undefined) {
    return def;
  }
  return value.toLowerCase() === "true";
}

function num(keys: string[], def: number): number {
  const value = pickEnv(keys);
  if (value === undefined) {
    return def;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : def;
}

function str(keys: string[], def: string): string {
  return pickEnv(keys) ?? def;
}

function list(keys: string[]): string[] {
  return (pickEnv(keys) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const hasMinPriceChangeConfig = pickEnv(["MIN_PRICE_CHANGE_M5", "MIN_PRICE_CHANGE_5M"]) !== undefined;

export const env = {
  ENABLE_LIVE_TRADING: bool(["ENABLE_LIVE_TRADING"], false),
  DRY_RUN: bool(["DRY_RUN"], true),
  WALLET_PRIVATE_KEY: pickEnv(["WALLET_PRIVATE_KEY"]),
  WALLET_KEYPAIR_PATH: pickEnv(["WALLET_KEYPAIR_PATH"]),
  WALLET_PUBKEY: pickEnv(["WALLET_PUBKEY"]),
  RPC_URL: str(["RPC_ENDPOINT", "RPC_URL"], "https://api.mainnet-beta.solana.com"),
  RPC_ENDPOINT: str(["RPC_ENDPOINT", "RPC_URL"], "https://api.mainnet-beta.solana.com"),
  BIRDEYE_API_KEY: pickEnv(["BIRDEYE_API_KEY"]),
  JUPITER_API_URL: str(["JUPITER_API_URL"], "https://quote-api.jup.ag/v6"),
  WATCHLIST_MINTS: list(["WATCHLIST_MINTS"]),
  MIN_LIQUIDITY_USD: num(["MIN_LIQUIDITY_USD", "MIN_LIQUIDITY_USDC"], 10_000),
  MIN_VOLUME_M5_USD: num(["MIN_VOLUME_M5_USD", "MIN_VOLUME_1H"], 1_000),
  MAX_VOLUME_M5_USD: num(["MAX_VOLUME_M5_USD", "MAX_VOLUME_1H"], 100_000),
  MAX_FDV_USD: num(["MAX_FDV_USD", "MAX_FDV_RATIO"], 250_000),
  MAX_PAIR_AGE_HOURS: num(["MAX_PAIR_AGE_HOURS", "MAX_TOKEN_AGE_HOURS"], 24),
  MAX_SEEN_PAIRS: num(["MAX_SEEN_PAIRS"], 5_000),
  REQUIRE_PRICE_UP_M5: bool(["REQUIRE_PRICE_UP_M5"], !hasMinPriceChangeConfig),
  MIN_PRICE_CHANGE_M5: num(["MIN_PRICE_CHANGE_M5", "MIN_PRICE_CHANGE_5M"], 0),
  MIN_TXNS_M5: num(["MIN_TXNS_M5", "MIN_TXNS"], 100),
  MAX_TXNS_M5: num(["MAX_TXNS_M5", "MAX_TXNS"], 1_000),
  MIN_BUYS_M5: num(["MIN_BUYS_M5", "MIN_BUYS"], 100),
  MAX_BUYS_M5: num(["MAX_BUYS_M5", "MAX_BUYS"], 1_000),
  MIN_SELLS_M5: num(["MIN_SELLS_M5", "MIN_SELLS"], 1),
  MAX_SELLS_M5: num(["MAX_SELLS_M5", "MAX_SELLS"], 100),
  MIN_LIQUIDITY_TO_FDV_RATIO: num(["MIN_LIQUIDITY_TO_FDV_RATIO"], 0.03),
  MAX_SELLS_TO_BUYS_RATIO: num(["MAX_SELLS_TO_BUYS_RATIO"], 1.5),
  MAX_PRICE_IMPACT_PCT: num(["MAX_PRICE_IMPACT_PCT"], 5),
  SLIPPAGE_BPS: num(["SLIPPAGE_BPS"], 300),
  PROFIT_TARGET_PCT: num(["PROFIT_TARGET_PCT"], 30),
  TRAILING_STOP_PCT: num(["TRAILING_STOP_PCT"], 15),
  MAX_MOMENTUM_FAIL_COUNT: num(["MAX_MOMENTUM_FAIL_COUNT"], 3),
  MAX_CONCURRENT_POSITIONS: num(["MAX_CONCURRENT_POSITIONS"], 3),
  WALLET_SPEND_CAP_USD: num(["WALLET_SPEND_CAP_USD"], 20),
  SIZING_LADDER: bool(["SIZING_LADDER"], true),
  NETWORK_FEE_USD_ESTIMATE: num(["NETWORK_FEE_USD_ESTIMATE"], 0.1),
  SOL_USD_FALLBACK: num(["SOL_USD_FALLBACK"], 150),
  POLL_INTERVAL_MS: num(["POLL_INTERVAL_MS"], 5_000),
  LOG_LEVEL: str(["LOG_LEVEL"], "info"),
  LOG_PRETTY: bool(["LOG_PRETTY"], false),
} as const;

export const hasPrivateKey = Boolean(env.WALLET_PRIVATE_KEY);
export const hasKeypairPath = Boolean(env.WALLET_KEYPAIR_PATH);
export const hasWallet = hasPrivateKey || hasKeypairPath;
export const hasMonitorOnly = Boolean(env.WALLET_PUBKEY);

export function isLiveEnabled(): boolean {
  return env.ENABLE_LIVE_TRADING;
}

export function isDryRun(): boolean {
  return env.DRY_RUN;
}

export function isMonitorOnlyLiveMode(): boolean {
  return isLiveEnabled() && !hasWallet && hasMonitorOnly;
}

export function hasWalletIdentity(): boolean {
  return hasWallet || hasMonitorOnly;
}

export function assertLiveWalletEnv(): void {
  if (!isLiveEnabled()) {
    return;
  }

  if (!env.RPC_URL) {
    throw new Error("RPC_URL is required when ENABLE_LIVE_TRADING=true");
  }

  if (env.WALLET_KEYPAIR_PATH && !fs.existsSync(env.WALLET_KEYPAIR_PATH)) {
    throw new Error(`WALLET_KEYPAIR_PATH not found: ${env.WALLET_KEYPAIR_PATH}`);
  }
}
