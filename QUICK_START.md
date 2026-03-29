# QUICK START GUIDE

**Fee-Aware Moonshot Bot - Get Running in Minutes**

## Three Ways to Deploy

### Option 1: Local Development (Fastest)

```bash
npm install
cp .env.example .env
# Edit .env with your settings
npm run build
npm run dev
```

Access dashboard: http://localhost:3000

### Option 2: Docker (Recommended for Testing)

```bash
cp .env.example .env
# Edit .env with your settings
npm run docker:build
npm run docker:up
```

Access dashboard: http://localhost:3000

### Option 3: VPS Production (24/7 Operation)

```bash
# From your local machine:
./scripts/deploy.sh your.vps.ip moonshot /opt/fee-aware-moonshot-bot

# Or manually SSH into VPS and run:
cd fee-aware-moonshot-bot
npm install && npm run build
npm run pm2:start
```

---

## Essential Commands

```bash
# Check system health
npm run health

# Build TypeScript
npm run build

# View logs
pm2 logs                          # All logs
pm2 logs --lines 100              # Last 100 lines
docker-compose logs -f bot        # Docker logs

# Control bot (PM2)
pm2 status                        # View status
pm2 restart fee-aware-moonshot-bot
npm run pm2:stop

# Control bot (Docker)
npm run docker:logs               # View logs
npm run docker:restart            # Restart
npm run docker:down               # Stop
```

---

## Configuration

### Must Configure (.env file)

| Variable | Example | Required |
|----------|---------|----------|
| `TELEGRAM_BOT_TOKEN` | `123456:ABCxyz...` | ✅ Yes |
| `OPENAI_API_KEY` | `sk-...` | ✅ Yes |
| `ENCRYPTION_KEY` | `0123456789abcdef` (32 bytes hex) | ✅ Yes |

### Optional Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `POLL_INTERVAL_MS` | 5000 | Trading check interval |
| `API_PORT` | 3000 | Web dashboard port |
| `ENABLE_LIVE_TRADING` | false | ⚠️ Enable only in production |
| `LOG_LEVEL` | info | Debug, info, warn, error |

### Generate Encryption Key

```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows (PowerShell)
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## What's Included?

✅ **Core Features**
- Multi-user support with per-user wallets
- Telegram bot for commands and notifications
- Real DEX market data integration (Raydium, Jupiter, Orca)
- AI-powered monitoring and auto-fix
- Private key encryption (AES-256-GCM)
- SQLite database with performance tracking

✅ **Production Ready**
- Docker containerization
- PM2 process management
- GitHub Actions CI/CD
- Automated VPS deployment
- Health checks and monitoring
- Comprehensive logging

✅ **Web Dashboard** (Port 3000)
- System status and metrics
- User management
- Trading history
- Market analysis
- Real-time logs

---

## First Run Checklist

- [ ] Create `.env` file from `.env.example`
- [ ] Add `TELEGRAM_BOT_TOKEN` from BotFather
- [ ] Add `OPENAI_API_KEY` from OpenAI
- [ ] Generate `ENCRYPTION_KEY` 
- [ ] Run `npm install && npm run build`
- [ ] Run `npm run health` (should show ✅ ok: true)
- [ ] Run `npm run dev` or `npm run docker:up`
- [ ] Open http://localhost:3000 in browser
- [ ] Test `/start` command in Telegram bot
- [ ] Verify logs show no errors

---

## Telegram Commands

```
/start          - Register/connect wallet
/status         - View bot status and portfolio  
/config         - View/edit trading settings
/trades         - View trading history
/start_trading  - Enable live trading
/stop           - Stop trading
/help           - Show help message
```

---

## Example .env File

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxyz

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# Encryption (generate: openssl rand -hex 32)
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Optional APIs
BIRDEYE_API_KEY=birdeye_key_here
RAYDIUM_API_KEY=raydium_key_here

# Always start with false!
ENABLE_LIVE_TRADING=false

# Server config
API_PORT=3000
POLL_INTERVAL_MS=5000
LOG_LEVEL=info
```

---

## Monitoring Commands

```bash
# Real-time system monitoring
pm2 monit

# View process details
pm2 info fee-aware-moonshot-bot

# Kill and restart
pm2 kill
pm2 start ecosystem.config.js

# Setup auto-restart on reboot
pm2 startup
pm2 save
```

---

## Updating Bot

```bash
# Pull latest code
git pull origin main

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Restart (PM2)
pm2 restart fee-aware-moonshot-bot

# Or restart (Docker)
docker-compose down
docker-compose up -d
```

---

## Help & Support

- **Logs**: `pm2 logs` or check `/logs` directory
- **Health**: `npm run health`
- **Documentation**: See `README.md` and `DEPLOYMENT_COMPLETE.md`
- **Issues**: Check GitHub issues page

---

**Ready to trade? 🚀**

Once you've verified everything works:

1. Register users via Telegram `/start` command
2. Have them provide their Solana wallet address
3. Carefully review trading settings
4. Enable live trading: `ENABLE_LIVE_TRADING=true`
5. Monitor logs: `pm2 logs`

Good luck! 📈
