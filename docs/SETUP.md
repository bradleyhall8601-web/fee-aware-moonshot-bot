# MoonShotForge Setup Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Telegram Bot Token (from @BotFather)
- Optional: OpenAI API key, Birdeye API key, Helius API key

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd moonshotforge
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your values

# 3. Run in development
npm run dev

# 4. Or build and run in production
npm run build
npm start
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required
- `TELEGRAM_BOT_TOKEN` — From @BotFather on Telegram
- `OWNER_TELEGRAM_ID` — Your Telegram user ID (get from @userinfobot)
- `ADMIN_PASSWORD` — Password for admin dashboard
- `ENCRYPTION_KEY` — 64-char hex string for encrypting private keys

### Optional but Recommended
- `OPENAI_API_KEY` — For AI signal gate and Boss AI
- `BIRDEYE_API_KEY` — For enhanced token security data
- `HELIUS_API_KEY` — For Solana transaction data
- `OWNER_PAYMENT_WALLET` — Your Solana wallet for SOL payments

## Telegram Bot Setup

1. Message @BotFather on Telegram
2. Create a new bot with `/newbot`
3. Copy the token to `TELEGRAM_BOT_TOKEN`
4. Get your Telegram ID from @userinfobot
5. Set `OWNER_TELEGRAM_ID` to your ID

## Admin Dashboard

Access at `http://localhost:5000/admin/login`

Default password is set via `ADMIN_PASSWORD` in `.env`

## Live Trading

Live trading is **disabled by default** (`ENABLE_LIVE_TRADING=false`).

To enable:
1. Ensure subscription is active
2. Connect wallet via Telegram
3. Admin must approve via `/grant` command
4. Set `ENABLE_LIVE_TRADING=true` in `.env`

## Deployment

See `deployment/` directory for Docker, PM2, and VPS deployment options.
