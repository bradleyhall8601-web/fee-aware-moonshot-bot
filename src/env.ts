import 'dotenv/config';

function bool(val: string | undefined, def: boolean): boolean {
  if (val === undefined) return def;
  return val.toLowerCase() === 'true';
}

function num(val: string | undefined, def: number): number {
  const n = Number(val);
  return isNaN(n) || val === undefined || val === '' ? def : n;
}

function str(val: string | undefined, def: string): string {
  return val !== undefined && val !== '' ? val : def;
}

export const env = {
  ENABLE_LIVE_TRADING: bool(process.env.ENABLE_LIVE_TRADING, false),
  WALLET_PRIVATE_KEY: str(process.env.WALLET_PRIVATE_KEY, ''),
  RPC_ENDPOINT: str(process.env.RPC_ENDPOINT, 'https://api.mainnet-beta.solana.com'),
  JUPITER_API_URL: str(process.env.JUPITER_API_URL, 'https://quote-api.jup.ag/v6'),
  WATCHLIST_MINTS: (process.env.WATCHLIST_MINTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  MIN_LIQUIDITY_USDC: num(process.env.MIN_LIQUIDITY_USDC, 10_000),
  MIN_VOLUME_1H: num(process.env.MIN_VOLUME_1H, 1_000),
  MAX_VOLUME_1H: num(process.env.MAX_VOLUME_1H, 100_000),
  MAX_FDV_RATIO: num(process.env.MAX_FDV_RATIO, 250_000),
  MAX_TOKEN_AGE_HOURS: num(process.env.MAX_TOKEN_AGE_HOURS, 24),
  MIN_PRICE_CHANGE_5M: num(process.env.MIN_PRICE_CHANGE_5M, 0),
  MIN_TXNS: num(process.env.MIN_TXNS, 100),
  MAX_TXNS: num(process.env.MAX_TXNS, 1_000),
  MIN_BUYS: num(process.env.MIN_BUYS, 100),
  MAX_BUYS: num(process.env.MAX_BUYS, 1_000),
  MIN_SELLS: num(process.env.MIN_SELLS, 1),
  MAX_SELLS: num(process.env.MAX_SELLS, 100),
  MAX_PRICE_IMPACT_PCT: num(process.env.MAX_PRICE_IMPACT_PCT, 5),
  SLIPPAGE_BPS: num(process.env.SLIPPAGE_BPS, 100),
  PROFIT_TARGET_PCT: num(process.env.PROFIT_TARGET_PCT, 30),
  TRAILING_STOP_PCT: num(process.env.TRAILING_STOP_PCT, 15),
  MAX_MOMENTUM_FAIL_COUNT: num(process.env.MAX_MOMENTUM_FAIL_COUNT, 3),
  POLL_INTERVAL_MS: num(process.env.POLL_INTERVAL_MS, 5_000),
  LOG_LEVEL: str(process.env.LOG_LEVEL, 'info'),
  LOG_PRETTY: bool(process.env.LOG_PRETTY, false),
} as const;
