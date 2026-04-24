# Developer Operations Guide

This repository runs a unified Solana auto-trading system with:
- Telegram control bot
- Express API + SQLite backend
- Trading orchestrator and Jupiter execution
- User/Admin web dashboards

## Safety defaults
- `ENABLE_LIVE_TRADING=false` by default.
- Never expose private keys or encryption keys in logs/responses.
- Keep `MASTER_ENCRYPTION_KEY` backend-only.

## Daily workflow
1. `npm install`
2. `npm run build`
3. `npm run check:live`
4. `npm run deploy:live` (or `./deploy.sh` on VPS host)

## Local run
```bash
npm install
npm run build
npx tsx src/index.ts
```

## Production run (PM2)
```bash
npm run check:live
npm run deploy:live
npx pm2 logs fee-aware-moonshot-bot
```

## Key endpoints
- `/health`
- `/api/system/status`
- `/api/system/logs`
- `/api/users`
- `/api/trades/:userId`
- `/api/execution/:userId`
- `/debug/status`

## Incident quick checks
```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/debug/status
npx pm2 status
npx pm2 logs fee-aware-moonshot-bot --lines 120 --nostream
```
