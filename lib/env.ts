import { z } from 'zod';

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
  OWNER_TELEGRAM_ID: z.string().regex(/^\d+$/),
  ADMIN_PASSWORD: z.string().min(12),
  ADMIN_SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(24),
  DEPLOY_SECRET: z.string().min(24),
  PUBLIC_BASE_URL: z.string().url(),
  ENABLE_LIVE_TRADING: z.literal('false').default('false'),
  PAPER_TRADING_ONLY: z.literal('true').default('true'),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  HELIUS_API_KEY: z.string().optional(),
  JUPITER_API_URL: z.string().url().default('https://quote-api.jup.ag/v6'),
  STRICT_DATA_GATE: z.enum(['true', 'false']).default('true'),
  DEFAULT_PAPER_NOTIONAL_USD: z.coerce.number().positive().max(10000).default(20),
  MAX_OPEN_POSITIONS: z.coerce.number().int().positive().max(100).default(3),
  MAX_DAILY_ENTRIES: z.coerce.number().int().positive().max(1000).default(20),
  MAX_DAILY_ENTRIES_PER_MINT: z.coerce.number().int().positive().max(100).default(2),
  SNIPER_MIN_SCORE: z.coerce.number().min(0).max(100).default(70),
  SCALP_MIN_SCORE: z.coerce.number().min(0).max(100).default(72),
  RIDE_MIN_SCORE: z.coerce.number().min(0).max(100).default(74),
});

export type ServerEnv = z.infer<typeof serverSchema>;
let cache: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cache) return cache;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid production environment: ${message}`);
  }
  cache = parsed.data;
  return cache;
}

export function assertPaperOnly(): void {
  const e = env();
  if (e.ENABLE_LIVE_TRADING !== 'false' || e.PAPER_TRADING_ONLY !== 'true') {
    throw new Error('REJECTED_LIVE_TRADING_DISABLED');
  }
}
