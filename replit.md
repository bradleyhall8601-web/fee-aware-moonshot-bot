# MoonShotForge — Replit Configuration

## Overview

MoonShotForge is a production-ready multi-user Solana meme-coin signal and trading bot.

## Running on Replit

1. Set environment variables in the Secrets panel:
   - `TELEGRAM_BOT_TOKEN` — Your Telegram bot token
   - `OWNER_TELEGRAM_ID` — Your Telegram user ID
   - `ADMIN_PASSWORD` — Admin dashboard password
   - `ENCRYPTION_KEY` — 64-char hex string

2. Click **Run** to start the bot

3. The bot will be available at the Replit URL on port 5000

## Commands

- `npm run dev` — Start in development mode
- `npm run build` — Build TypeScript
- `npm start` — Start compiled production build
- `npm test` — Run tests

## Architecture

- **Backend**: TypeScript + Express on port 5000
- **Database**: SQLite (data/bot.db)
- **Telegram**: Telegraf bot
- **Market Data**: DexScreener, GeckoTerminal, PumpFun, Raydium, Birdeye
- **AI**: OpenAI GPT-4o-mini (optional)
- **Trading**: Paper mode by default, Jupiter for live

## Key Files

- `src/index.ts` — Entry point
- `src/bot-orchestrator.ts` — Main trading loop
- `src/telegram-multi.ts` — Telegram bot
- `src/api-server.ts` — REST API + dashboard
- `src/database.ts` — SQLite database
- `src/confidence-scorer.ts` — 8-component scoring
- `src/paper-trading.ts` — Paper trading engine
- `public/` — Static web pages

## Live Trading

Live trading is **disabled by default**. Set `ENABLE_LIVE_TRADING=true` only after:
1. Paper trading shows consistent profits
2. Wallet is funded with SOL
3. Admin has approved the user
