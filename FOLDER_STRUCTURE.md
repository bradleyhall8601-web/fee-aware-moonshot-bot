# 📁 Complete Project Structure Overview

Everything organized and ready for deployment.

## Directory Tree

```
fee-aware-moonshot-bot/                    ← PROJECT ROOT
│
├── 📂 src/                                ← SOURCE CODE (TypeScript)
│   ├── index.ts                          [Main entry point]
│   ├── bot-orchestrator.ts               [Coordinates all systems]
│   │
│   ├── 🤖 TELEGRAM BOT
│   ├── telegram-multi.ts                 [Multi-user Telegram bot]
│   ├── telegram-registration.ts          [Enhanced registration flow] ← NEW!
│   │
│   ├── 💰 TRADING
│   ├── trading-engine.ts                 [Trade execution logic]
│   ├── dex-market-data.ts                [Market data from DEXs]
│   ├── technical-analysis.ts             [RSI, MACD, Bollinger Bands]
│   ├── advanced-risk-management.ts       [Portfolio risk analysis]
│   ├── security-analysis.ts              [Rug pull detection]
│   ├── token-scoring-engine.ts           [Unified token scoring]
│   ├── risk.ts                           [Stop-loss management]
│   │
│   ├── 🔧 INFRASTRUCTURE
│   ├── api-server.ts                     [REST API server]
│   ├── user-manager.ts                   [User management]
│   ├── database.ts                       [SQLite wrapper]
│   ├── telemetry.ts                      [Logging & monitoring]
│   ├── ai-monitor.ts                     [AI error detection]
│   └── config.ts                         [Configuration loader]
│
├── 📂 deployment/                        ← DEPLOYMENT PACKAGE
│   │
│   ├── 📂 vps/                           [Linux VPS setup & scripts]
│   │   ├── setup.sh                      [Initial VPS setup]
│   │   ├── deploy.sh                     [Deploy application]
│   │   ├── health-check.sh               [Monitor system health]
│   │   ├── restart.sh                    [Graceful restart]
│   │   └── backup.sh                     [Database backup]
│   │
│   ├── 📂 docker/                        [Docker containerization]
│   │   ├── Dockerfile                    [Container image]
│   │   ├── docker-compose.yml            [Multi-container setup]
│   │   └── .dockerignore                 [Build optimization]
│   │
│   ├── 📂 pm2/                           [Process management]
│   │   ├── ecosystem.config.js           [PM2 configuration]
│   │   └── startup.sh                    [PM2 initialization]
│   │
│   └── 📂 docs/                          [Documentation]
│       ├── SETUP.md                      [VPS setup guide]
│       ├── USER_REGISTRATION.md          [User onboarding guide]
│       └── CHECKLIST.md                  [Pre-deployment checklist]
│
├── 📂 data/                              ← PERSISTENT DATA
│   ├── trades.db                         [SQLite database (created at runtime)]
│   └── backups/                          [Auto backups (daily)]
│
├── 📂 logs/                              ← APPLICATION LOGS
│   ├── combined.log                      [All logs]
│   └── err.log                           [Error logs]
│
├── 📂 dist/                              ← COMPILED JavaScript
│   ├── index.js                          [Executable after npm run build]
│   └── [other compiled files]
│
├── 📂 node_modules/                      ← Dependencies (npm install)
│   └── [1000+ files]
│
├── 📂 public/                            ← Static dashboard files
│   └── [HTML, CSS, JS]
│
│
├── 📄 CONFIG FILES
├── package.json                          [Dependencies & scripts]
├── tsconfig.json                         [TypeScript config]
├── Dockerfile                            [Legacy Docker file]
├── docker-compose.yml                    [Legacy Docker config]
├── ecosystem.config.js                   [Legacy PM2 config]
├── jest.config.js                        [Testing config]
│
├── 📄 DOCUMENTATION
├── README.md                             [Project overview]
├── PRODUCTION_READY.md                   [This deployment guide] ← START HERE
├── DEPLOYMENT_STRUCTURE.md               [Folder structure]
├── DEPLOYMENT_COMPLETE.md                [Completion notes]
├── BOT_LIVE.md                           [Bot status]
├── QUICK_START.md                        [Quick start guide]
│
├── 🔐 SECRETS (NEVER COMMIT)
├── .env                                  [Your credentials - DO NOT PUSH]
├── .env.example                          [Template only]
│
└── 📕 GIT REPOSITORY
    └── .git/                             [Version control]
```

## What to Deploy to VPS

Only these files go to your VPS:

```bash
/opt/moonshot-bot/
├── src/                    ✓ TypeScript source
├── deployment/             ✓ Deployment scripts
├── dist/                   ✓ Compiled code (after npm run build)
├── data/                   ✓ Created at runtime
├── logs/                   ✓ Created at runtime
├── package.json            ✓ Dependencies list
├── package-lock.json       ✓ Locked versions
├── tsconfig.json           ✓ Build config
├── ecosystem.config.js     ✓ PM2 config
├── .env                    ✓ Your secrets (created manually)
│
└── ✗ DO NOT PUSH
    ├── node_modules/       [Reinstalled with npm install]
    ├── .git/               [Version control, not needed]
    └── dist/               [Rebuilt with npm run build]
```

## File Sizes & Purposes

| File | Size | Purpose |
|------|------|---------|
| `src/index.ts` | 2KB | Main entry point |
| `src/telegram-multi.ts` | 15KB | Bot processor |
| `src/telegram-registration.ts` | 12KB | User registration ← NEW |
| `src/trading-engine.ts` | 20KB | Trade execution |
| `src/api-server.ts` | 18KB | REST API |
| `src/database.ts` | 8KB | Database wrapper |
| **Total src/** | **~140KB** | All source code |
| `deployment/vps/*.sh` | 5KB each | Deployment scripts |
| `deployment/docker/*` | 3KB each | Container config |
| `dist/` (after build) | 200KB | Compiled JavaScript |

## Deployment Workflow

### 1️⃣ **Local Development** (Your Machine)
```
Code changes in src/
├── npm run build          ← Compiles TypeScript
├── npm run dev            ← Runs locally
└── Test locally
```

### 2️⃣ **Commit to Git** (GitHub)
```
git add .
git commit -m "Added new feature"
git push origin main
```

### 3️⃣ **Deploy to VPS**
```bash
# On VPS:
cd /opt/moonshot-bot
git pull origin main
npm install
npm run build
pm2 restart fee-aware-moonshot-bot
```

### 4️⃣ **Monitor** (VPS)
```bash
pm2 logs
pm2 monit
./deployment/vps/health-check.sh
```

## Environment Setup

### .env File (Created Manually on VPS)

```env
# 🔐 SECRETS - Create this file on VPS, never commit to git

# Telegram
TELEGRAM_BOT_TOKEN=7123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi
TELEGRAM_ADMIN_ID=123456789

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# OpenAI (optional)
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# API Server
API_PORT=3000
API_HOST=0.0.0.0

# Database
DB_PATH=/data/trades.db

# Trading
LIVE_TRADING_ENABLED=false

# Logging
LOG_LEVEL=info
```

## Scripts Quick Reference

### From VPS Terminal

```bash
# One-time setup
./deployment/vps/setup.sh

# Deploy code
./deployment/vps/deploy.sh

# Check health
./deployment/vps/health-check.sh

# Restart bot
./deployment/vps/restart.sh

# Backup database
./deployment/vps/backup.sh
```

### Using npm

```bash
# Build
npm run build

# Run development
npm run dev

# Start production
npm start

# Health check
npm run health

# PM2 commands
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
```

### Using PM2

```bash
# List processes
pm2 list

# View logs
pm2 logs

# Monitor
pm2 monit

# Stop
pm2 stop fee-aware-moonshot-bot

# Restart
pm2 restart fee-aware-moonshot-bot

# Delete
pm2 delete fee-aware-moonshot-bot

# Save for auto-startup
pm2 save
```

### Using Docker

```bash
# Build image
docker build -t moonshot-bot .

# Start container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild & restart
docker-compose up -d --build
```

## Data Persistence

### What Gets Backed Up

```
/data/backups/
├── trades_20260328_080000.db.gz    ← Daily backups
├── trades_20260327_080000.db.gz    ← Kept 7 days
└── ...

/logs/
├── combined.log                    ← All logs
├── combined.log.1                  ← Rotated daily
└── ...
```

### Restore from Backup

```bash
# Stop bot
pm2 stop fee-aware-moonshot-bot

# Restore
cd data/backups
gunzip -c trades_20260328_080000.db.gz > ../trades.db

# Restart
pm2 restart fee-aware-moonshot-bot
```

## Monitoring Dashboard

Once deployed, access at:

```
Telegram Bot:     @MoonShotForge_bot
API Health:       http://your_vps_ip:3000/health
API Server:       http://your_vps_ip:3000
Logs:             pm2 logs
Process Monitor:  pm2 monit
SSH Terminal:     ssh user@your_vps_ip
```

## Next Steps

1. **Read** `PRODUCTION_READY.md` (main guide)
2. **Follow** `deployment/docs/SETUP.md` (step-by-step)
3. **Check** `deployment/docs/CHECKLIST.md` (before production)
4. **Deploy** using `deployment/vps/setup.sh`
5. **Monitor** with `pm2 logs` and health checks

---

**Everything is organized. Everything is ready. Let's deploy! 🚀**
