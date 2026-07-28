# MoonShotForge 3.0

MoonShotForge is rebuilt for a **Vercel + Supabase-only** production architecture. There is no separate worker service, VPS, PM2 process, Docker host, Replit keep-alive, production SQLite file, or Telegram polling loop.

## What is active

- Next.js web application and API functions on Vercel
- Supabase Postgres as the system of record
- Supabase Cron invoking short, idempotent Vercel jobs every minute
- Telegram HTTPS webhook with secret-header verification
- Separate deterministic SNIPER, SCALP, and RIDE scores for every evaluated candidate
- Candidate identity, all score components, qualification results, rejection codes, selected winner, signals, positions, jobs, and activity persisted in Supabase
- Paper-position opening and closing in atomic Postgres functions
- Strategy circuit breakers and daily limits persisted across restarts
- Owner-only BOSS Telegram report using an activity cursor
- Owner admin dashboard using server-side service-role access

## Safety

The runtime validates both:

```text
ENABLE_LIVE_TRADING=false
PAPER_TRADING_ONLY=true
```

The database repeats the check inside `create_signal_and_position`. The rebuilt runtime contains no wallet signing or live-order execution route.

## Deployment order

1. Create or choose a Supabase project.
2. Run every SQL file in `supabase/migrations` in filename order, or apply them with the Supabase CLI.
3. Import this repository into a new Vercel project.
4. Enter every variable from `.env.example` in Vercel. Secrets must be entered in Vercel, never committed.
5. Deploy and assign the custom domain.
6. Set `PUBLIC_BASE_URL` to the final HTTPS domain and redeploy.
7. Run `node scripts/configure-production.mjs` with the same production variables loaded. It configures Supabase Cron, registers the Telegram webhook, and checks health.
8. Open `/admin`, sign in, and verify the two jobs are recording successful runs.

## Required external values

The source package cannot invent or retrieve account secrets. Production needs values owned by the account holder:

- Supabase project URL and server secret key
- Telegram BotFather token
- Telegram owner user ID
- Vercel admin/session/job secrets
- Optional Helius API key for holder-distribution data

With `STRICT_DATA_GATE=true`, missing holder or sell-route evidence is stored as a named rejection instead of being guessed. This may intentionally produce zero signals until Helius and the quote provider are healthy.

## Scheduled processing

Supabase Cron calls:

```text
POST /api/jobs/scan
POST /api/jobs/positions
Authorization: Bearer <CRON_SECRET>
```

Both functions use a database lease to prevent overlapping runs. Vercel Cron is not required.

## Telegram commands

```text
/start
/menu
/health
/status
/signals
/trades
/pnl
/boss
```

`/boss` is owner-only and returns recorded activity since the previous successful BOSS check.

## Verification

```bash
npm install
npm run typecheck
npm test
npm run build
PUBLIC_BASE_URL=https://your-domain.example \
CRON_SECRET=... \
node scripts/verify-production.mjs
```

The deployment package contains only the rebuilt Vercel and Supabase application. The original Replit runtime, local databases, caches, and secret-bearing files are deliberately excluded.

## Persisted calibration and caps

`strategy_config` is the live source for each strategy's score threshold, paper notional, stop, target, trailing rules, maximum hold, daily entry cap, and per-mint daily cap. `strategy_runtime` persists enabled state, loss streaks, pause windows, daily entries, and daily P&L. Both survive application restarts because they are stored in Supabase.

Generate the non-provider secrets locally with:

```bash
npm run generate:secrets
```

After the migration, Vercel deployment, final domain, and environment variables exist, the protected `/api/deploy/configure` route connects Supabase Cron and the Telegram webhook in one call. `scripts/configure-production.mjs` calls that route without placing the Supabase server secret on a workstation.
