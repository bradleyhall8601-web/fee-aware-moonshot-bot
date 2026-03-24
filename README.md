# Fee-Aware Moonshot Bot

> **⚠️ SAFE MODE – Paper Trading Only**
>
> This bot runs exclusively in simulation / paper-trading mode.
> **No real funds are ever moved. No private keys are required or accepted.**

---

## Purpose

A Solana meme-coin monitoring and paper-trading bot that:

- Auto-scans [DexScreener](https://dexscreener.com) for Solana meme-coin candidates
- Filters by liquidity, volume, and buy/sell ratio
- Simulates buys and sells in paper mode (no real transactions)
- Tracks take-profit and trailing-stop exits
- Monitors watched wallets for whale-signal scaffolding
- Exposes full control via a Telegram bot
- Optionally logs trades to PostgreSQL
- Supports Helius RPC for enhanced Solana data

---

## Safe-Mode Disclaimer

This software is provided for **educational and research purposes only**.

- `ENABLE_LIVE_TRADING` is permanently `false` in the source code
- No wallet private keys are used or required
- All "buys" and "sells" are simulated against a virtual cash balance
- The bot will refuse to start if live trading is somehow enabled

---

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- npm ≥ 9
- (Optional) A Telegram bot token from [@BotFather](https://t.me/BotFather)
- (Optional) A [Helius](https://helius.xyz) API key for enhanced Solana data
- (Optional) A PostgreSQL database for trade logging

---

## Install

```bash
git clone https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot.git
cd fee-aware-moonshot-bot
npm install
```

---

## Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot token from BotFather |
| `HELIUS_RPC_URL` | Optional | Helius RPC endpoint (improves reliability) |
| `HELIUS_API_KEY` | Optional | Helius API key for token metadata |
| `POSTGRES_URL` | Optional | PostgreSQL connection string for trade logging |
| `SIM_START_BALANCE_USD` | No (default: 1000) | Starting paper-trade cash |
| `MAX_BUY_USD` | No (default: 100) | Max USD per paper buy |
| `MIN_LIQUIDITY_USD` | No (default: 7500) | Min pool liquidity to consider |
| `MIN_VOLUME_USD` | No (default: 500) | Min 24h volume to consider |
| `MIN_BUY_SELL_RATIO` | No (default: 1.05) | Min buy/sell tx ratio |
| `TAKE_PROFIT_PCT` | No (default: 30) | Take-profit trigger (%) |
| `TRAILING_STOP_PCT` | No (default: 15) | Trailing stop trigger (%) |
| `POLL_INTERVAL_MS` | No (default: 30000) | Auto-scan interval in ms |
| `WATCH_WALLETS` | No | Comma-separated public wallet addresses to monitor |
| `LOG_LEVEL` | No (default: info) | Log verbosity |

---

## Telegram BotFather Setup

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the token and set `TELEGRAM_BOT_TOKEN=<your-token>` in your `.env`
4. Start the bot, then open your bot in Telegram and send `/start`

---

## Run Commands

| Command | Description |
|---|---|
| `npm run dev` | Start bot in development mode (hot reload via tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled bot from `dist/index.js` |
| `npm run health` | Print health check JSON and exit |

---

## Health Check

```bash
npm run health
```

Example output:

```json
{
  "ok": true,
  "helius": true,
  "dexscreener": true,
  "postgres": false,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "cashUsd": 1000,
  "openPositions": 0,
  "mode": "paper"
}
```

---

## Telegram Commands

| Command | Description |
|---|---|
| `/start` | Welcome message and command list |
| `/status` | Bot status: cash, positions, PnL, uptime |
| `/positions` | List open paper positions |
| `/cash` | Show available paper cash |
| `/scan` | Scan DexScreener for top candidates |
| `/buy SYMBOL` | Simulate buying a token by symbol |
| `/sell SYMBOL` | Simulate selling an open position |
| `/watch ADDRESS` | Add a wallet address to the watch list |
| `/watches` | List all watched wallets |

---

## Whale Tracking

Watched wallets are stored in state and surfaced via `/watch` and `/watches` commands.

The whale signal provider (`src/providers.ts`) contains a scaffold that returns empty signals until real on-chain parsing is implemented. TODOs in the code mark where to integrate Helius enhanced transaction feeds.

---

## Architecture

```
src/
├── index.ts       – Entry point, poll loop, health check
├── config.ts      – Env-driven configuration
├── types.ts       – Shared TypeScript interfaces
├── state.ts       – In-memory paper-trading state
├── risk.ts        – Position sizing, stop-loss, take-profit
├── providers.ts   – DexScreener, Helius, RugCheck, whale scaffold
├── strategy.ts    – Candidate filtering, scoring, buy/sell simulation
├── telegram.ts    – Telegraf bot with all commands
└── debug.ts       – Debug state dump utility
```

---

## Remaining TODOs

- [ ] Integrate Helius enhanced transactions API for real whale parsing
- [ ] Add RugCheck filtering to reject rugged tokens
- [ ] Persist paper trades to PostgreSQL on each trade (currently logs run start only)
- [ ] Add CoinGecko price feed as fallback
- [ ] Implement position refresher that polls all open positions every N seconds

---

## License

MIT
