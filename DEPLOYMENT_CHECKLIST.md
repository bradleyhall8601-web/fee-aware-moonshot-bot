# Production checklist

## Supabase

- [ ] Run all SQL migrations in `supabase/migrations` in filename order.
- [ ] Confirm tables `candidates`, `strategy_scores`, `signals`, `paper_positions`, `activity_log`, and `job_runs` exist.
- [ ] Confirm RLS is enabled and there are no anon/authenticated policies.
- [ ] Confirm `strategy_runtime` has SNIPER, SCALP, and RIDE rows.

## Vercel

- [ ] Create a new project from the reviewed GitHub repository.
- [ ] Framework preset: Next.js.
- [ ] Add every server variable from `.env.example`.
- [ ] Keep `ENABLE_LIVE_TRADING=false` and `PAPER_TRADING_ONLY=true`.
- [ ] Deploy and add the final custom domain.
- [ ] Update `PUBLIC_BASE_URL` to that domain, then redeploy.

## Connect services

Run from a trusted terminal with the production variables loaded:

```bash
node scripts/configure-production.mjs
```

This performs the three account-side connections that code alone cannot authorize:

1. Stores the Vercel origin and cron bearer secret in Supabase Vault.
2. Creates Supabase Cron jobs for scanning and position monitoring.
3. Registers Telegram to the Vercel webhook and verifies the webhook info.

## Final checks

- [ ] `/api/health` returns `ok: true` and `mode: paper-only`.
- [ ] `/start` opens the Telegram menu.
- [ ] `/boss` works only for `OWNER_TELEGRAM_ID`.
- [ ] Admin dashboard shows successful `candidate_scan` and `position_monitor` jobs.
- [ ] Rejected candidates show named reasons when required provider data is missing.
- [ ] No private key, wallet seed, `.env`, SQLite DB, or production token exists in Git.

## Persistent safety checks

- [ ] `strategy_config` contains one row for SNIPER, SCALP, and RIDE.
- [ ] Per-mint daily entry caps return `REJECTED_PER_MINT_DAILY_CAP` when reached.
- [ ] Attempts to enable live trading in `system_settings` are rejected by the database trigger.
- [ ] Telegram duplicate updates are claimed once and failed updates are retryable.
