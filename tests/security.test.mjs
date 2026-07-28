import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = path => readFile(join(root, path), 'utf8');

test('paper-only environment is explicit', async () => {
  const env = await read('.env.example');
  assert.match(env, /ENABLE_LIVE_TRADING=false/);
  assert.match(env, /PAPER_TRADING_ONLY=true/);
});

test('deployment architecture is Vercel and Supabase only', async () => {
  const pkg = await read('package.json');
  const vercel = await read('vercel.json');
  const architecture = await read('ACTIVE_ARCHITECTURE.md');
  assert.match(pkg, /moonshotforge-vercel-supabase/);
  assert.match(vercel, /nextjs/);
  assert.match(architecture, /Supabase Cron/);
  assert.doesNotMatch(pkg, /WORKER_ORIGIN|PM2|Docker/);
});

test('Supabase migration enforces persistent scoring and paper positions', async () => {
  const sql = (await Promise.all([
    'supabase/migrations/202607280001_core.sql',
    'supabase/migrations/202607280002_job_claims.sql',
    'supabase/migrations/202607280003_paper_trading.sql',
    'supabase/migrations/202607280004_cron_security.sql',
  ].map(read))).join('\n');
  for (const required of ['strategy_scores','strategy_config','create_signal_and_position','close_paper_position','claim_job','claim_telegram_update','configure_moonshot_cron','enable row level security']) {
    assert.ok(sql.includes(required), `missing ${required}`);
  }
  assert.match(sql, /REJECTED_LIVE_TRADING_DISABLED/);
  assert.match(sql, /REJECTED_PER_MINT_DAILY_CAP/);
  assert.match(sql, /PAPER_TRADING_ONLY cannot be disabled/);
});

test('Telegram webhook validates the Bot API secret header', async () => {
  const route = await read('app/api/telegram/webhook/route.ts');
  assert.match(route, /x-telegram-bot-api-secret-token/);
  assert.match(route, /TELEGRAM_WEBHOOK_SECRET/);
});
