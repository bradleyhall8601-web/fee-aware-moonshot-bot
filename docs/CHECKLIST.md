# MoonShotForge Deployment Checklist

## Pre-Deployment

- [ ] `.env` file configured with all required values
- [ ] `TELEGRAM_BOT_TOKEN` set and tested
- [ ] `OWNER_TELEGRAM_ID` set to your Telegram ID
- [ ] `ADMIN_PASSWORD` set to a strong password
- [ ] `ENCRYPTION_KEY` set to a 64-char hex string
- [ ] `ENABLE_LIVE_TRADING=false` (default, safe)
- [ ] `data/` directory exists and is writable
- [ ] `logs/` directory exists and is writable

## Build

- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds
- [ ] `npm test` passes

## Runtime Checks

- [ ] `GET /health` returns `{ ok: true }`
- [ ] `GET /api/status` returns system status
- [ ] `GET /api/signals` returns array
- [ ] Admin login works at `/admin/login`
- [ ] Telegram bot responds to `/start`
- [ ] Paper trading is active

## Security

- [ ] Private keys are encrypted (never plain text)
- [ ] Admin password is strong
- [ ] `ENABLE_LIVE_TRADING=false` unless intentionally enabled
- [ ] No secrets in git history
- [ ] `.env` is in `.gitignore`

## Monitoring

- [ ] Logs are being written to `logs/`
- [ ] Stability monitor is running
- [ ] AI self-improvement cycle is running
- [ ] Telegram notifications working
