# fee-aware-moonshot-bot

> ⚠️ **DISCLAIMER:** This software is for **educational purposes only**. Cryptocurrency trading carries significant financial risk. There are **no profit guarantees**. You may lose all invested funds. Use at your own risk. The authors accept **no liability** for any losses.

---

A Solana meme-coin trading bot that scans DexScreener for early-momentum tokens, applies a strict "Protected Moonshot Ladder" filter, and executes swaps via Jupiter. **Paper trading is ON by default** — no real funds are used unless you explicitly enable live mode.

## Features

- 🔍 **Discovery** via DexScreener search + optional watchlist
- 🪜 **Protected Moonshot Ladder** — strict multi-criteria filter (liquidity, age, volume, txns, momentum)
- 🪐 **Jupiter Metis swaps** — best-route quotes with slippage and fee visibility
- 💰 **Fee-aware** — estimates network + priority + Jupiter routing fees before each trade
- 📈 **30% take-profit lock** — auto-sells 50% to secure gains, manages remaining as a runner
- 🛑 **Hard stop-loss** + trailing stop + momentum exit
- 📄 **Paper mode** — simulates trades without a wallet
- 🗄️ **JSON persistence** — positions and trade history saved to `trades.json`
- 📊 **Structured logs** via `pino`
- ✅ **Zod config validation** — process exits if config is invalid

---

## Repository Layout

```
fee-aware-moonshot-bot/
├── src/
│   ├── index.ts            # Main bot loop (entry point)
│   ├── config.ts           # Env-var validation (zod)
│   ├── logger.ts           # Pino structured logger
│   ├── dexscreener.ts      # DexScreener API client
│   ├── jupiter.ts          # Jupiter quote + swap-instructions
│   ├── solana.ts           # Solana RPC helpers + tx builder
│   ├── strategy/
│   │   ├── filters.ts      # Protected Moonshot Ladder
│   │   ├── entry.ts        # Position entry logic
│   │   └── exit.ts         # Stop-loss / take-profit / trailing stop
│   ├── positions/
│   │   ├── types.ts        # Position / Trade interfaces
│   │   └── store.ts        # JSON file persistence
│   └── utils/
│       ├── rateLimit.ts    # Token-bucket rate limiter
│       └── retry.ts        # Exponential-backoff retry
├── tests/
│   ├── filters.test.ts     # Unit tests for filter logic
│   └── pnl.test.ts         # Unit tests for PnL / exit decisions
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** (check: `node --version`)
- **npm** (bundled with Node)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USER/fee-aware-moonshot-bot.git
cd fee-aware-moonshot-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Open `.env` and review the settings. **All defaults are safe** — the bot starts in paper mode with conservative parameters.

### 4. Run in paper mode (recommended to start)

```bash
npm run dev
```

You will see structured JSON logs. The bot will:
- Discover candidate pairs on DexScreener
- Apply the Protected Moonshot Ladder filters
- Simulate trades (no wallet needed)
- Print a summary table each loop

### 5. Build for production

```bash
npm run build
npm start
```

---

## iPhone / Cloud Deploy Setup

If you are deploying from an iPhone via GitHub + a cloud runner (e.g. Railway, Render, Fly.io):

1. **Fork** this repository on GitHub.
2. **Add secrets** in your cloud provider's dashboard (not in the repo!):
   - `SOLANA_RPC_URL` — your RPC endpoint
   - `WALLET_PRIVATE_KEY` — your wallet's private key (base58 or JSON array)
3. **Set** `ENABLE_LIVE_TRADING=true` only when you are ready.
4. **Deploy** the Docker image (see Docker section below).

> Never commit your `.env` file. Never share your `WALLET_PRIVATE_KEY`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `WALLET_PRIVATE_KEY` | _(empty)_ | Base58 or JSON-array private key. Only used if `ENABLE_LIVE_TRADING=true` |
| `ENABLE_LIVE_TRADING` | `false` | **Must be `true` to execute real swaps** |
| `ENABLE_KILL_SWITCH` | `false` | Set `true` to pause all new trades immediately |
| `QUOTE_API_BASE` | `https://api.jup.ag/swap/v1` | Jupiter Metis API base URL |
| `DEXSCREENER_BASE` | `https://api.dexscreener.com` | DexScreener API base URL |
| `INPUT_MINT` | `So11…112` (wSOL) | Input token mint for swaps |
| `WATCHLIST_MINTS` | _(empty)_ | Comma-separated token mints to monitor (skips keyword search) |
| `POSITION_SIZE_SOL` | `0.05` | SOL per trade |
| `MAX_OPEN_POSITIONS` | `2` | Maximum simultaneous open positions |
| `MIN_LIQUIDITY_USD` | `10000` | Minimum pool liquidity |
| `MAX_PAIR_AGE_HOURS` | `24` | Maximum pair age in hours |
| `MIN_TXNS` | `100` | Minimum transactions in best window |
| `MAX_TXNS` | `1000` | Maximum transactions in best window |
| `MIN_BUYS` | `100` | Minimum buy transactions |
| `MAX_BUYS` | `1000` | Maximum buy transactions |
| `MIN_SELLS` | `1` | Minimum sell transactions |
| `MAX_SELLS` | `100` | Maximum sell transactions |
| `MIN_VOLUME_USD` | `1000` | Minimum volume (USD) |
| `MAX_VOLUME_USD` | `100000` | Maximum volume (USD) |
| `REQUIRE_5M_PRICE_UP` | `true` | Require positive 5m price change for entry |
| `SLIPPAGE_BPS` | `150` | Slippage tolerance in basis points (150 = 1.5%) |
| `PRIORITY_FEE_MICRO_LAMPORTS` | _(empty)_ | Optional priority fee in micro-lamports |
| `STOP_LOSS_PCT` | `18` | Hard stop-loss percentage |
| `TAKE_PROFIT_LOCK_PCT` | `30` | Profit % at which to sell partial position |
| `TAKE_PROFIT_LOCK_SELL_PCT` | `50` | % of position to sell at take-profit |
| `RUNNER_TRAIL_STOP_PCT` | `12` | Trailing stop % from peak for remaining runner |
| `MOMENTUM_EXIT_IF_5M_RED` | `true` | Exit runner if 5m candle turns red |
| `DEXSCREENER_RATE_LIMIT_RPM` | `240` | DexScreener requests per minute |
| `POLL_INTERVAL_SECONDS` | `20` | Seconds between each bot loop |
| `LOG_LEVEL` | `info` | Pino log level (trace/debug/info/warn/error/fatal) |

---

## Bot Logic Overview

### Discovery

1. If `WATCHLIST_MINTS` is set: fetch pairs for each mint using `/token-pairs/v1/solana/{mint}`.
2. Otherwise: run keyword searches (`SOL`, `USDC`, `Raydium`, `meme`, `pump`) via `/latest/dex/search?q=...` and merge unique pairs.

> **DexScreener API limitation:** The search endpoint may not return all new pairs. For best results, populate `WATCHLIST_MINTS` with specific tokens you want to monitor.

### Protected Moonshot Ladder (filters)

Each candidate pair must pass ALL of these gates:

| Gate | Condition |
|---|---|
| Liquidity | `>= MIN_LIQUIDITY_USD` |
| Pair age | `<= MAX_PAIR_AGE_HOURS` |
| Volume | in `[MIN_VOLUME_USD, MAX_VOLUME_USD]` |
| Transaction count | in `[MIN_TXNS, MAX_TXNS]` |
| Buy count | in `[MIN_BUYS, MAX_BUYS]` |
| Sell count | in `[MIN_SELLS, MAX_SELLS]` |
| 5m momentum | `priceChange.m5 > 0` (if `REQUIRE_5M_PRICE_UP=true`) |

Pairs are then ranked by total transaction count (highest first).

### Entry

- Safety checks: liquidity, existing position, open position limit, price impact
- In **paper mode**: simulates fill at DexScreener price with estimated fees
- In **live mode**: calls Jupiter quote → swap-instructions → builds VersionedTransaction → sends to RPC → confirms

### Position Management

```
Entry
  │
  ├─ PnL >= +30%? → sell 50%, keep runner
  │     Runner:
  │       ├─ Trailing stop (price drops 12% from peak) → sell all
  │       └─ 5m red + halfSold? → sell all (momentum exit)
  │
  └─ PnL <= -18%? → sell all (hard stop loss)
```

### Fee Accounting

Each trade estimates:
- **Network fee**: from `getRecentBlockhash.feeCalculator` or conservative constant (5000 lamports)
- **Priority fee**: `PRIORITY_FEE_MICRO_LAMPORTS` if set
- **Jupiter routing fee**: from quote's `platformFee` field

All fees are logged before any live trade is submitted.

---

## Running Tests

```bash
npm test
```

Tests cover:
- Filter logic (all Protected Moonshot Ladder gates)
- PnL calculations
- Exit decision logic (stop-loss, take-profit, trailing stop, momentum exit)

---

## Docker

```bash
docker build -t fee-aware-moonshot-bot .

# Paper mode (no wallet needed)
docker run --env-file .env fee-aware-moonshot-bot

# Live mode
docker run -e ENABLE_LIVE_TRADING=true -e WALLET_PRIVATE_KEY=<key> \
  -e SOLANA_RPC_URL=<rpc> fee-aware-moonshot-bot
```

---

## Security Notes

- **Private keys are never logged.**
- All env vars are validated at startup via zod; the process exits immediately if config is invalid.
- Rate limiting and exponential-backoff retries prevent API abuse.
- The bot only makes outbound calls to: your configured RPC, DexScreener, and Jupiter.

---

## Ads / Boosted Pairs

DexScreener's "boosted" or "ads" flag is available in the site UI but is **not exposed in the public API**. The bot cannot filter on this automatically. Recommendation: manually review top candidates in the DexScreener UI before adding them to `WATCHLIST_MINTS`.

---

## License

MIT
