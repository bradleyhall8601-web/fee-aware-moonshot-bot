# VPS Deployment Guide

Complete step-by-step guide to deploy Fee-Aware Moonshot Bot on a VPS for 24/7 operation.

## Prerequisites

- VPS with Ubuntu 20.04+ or similar Linux (or Mac)
- 2GB+ RAM (4GB recommended)
- 10GB+ disk space
- SSH access to your VPS
- Docker (optional, but recommended) OR Node.js 20+

## VPS Providers Recommended

- **DigitalOcean** - $6/month droplet
- **Linode** - $5/month Nanode
- **AWS EC2** - $0-50/month depending on size
- **Vultr** - $2.50/month basic plan
- **Hetzner** - €3/month starting

## Step 1: VPS Setup (First Time Only)

### 1a. Connect to VPS

```bash
ssh root@your_vps_ip
```

Or use your VPS provider's terminal/console.

### 1b. Clone Project

```bash
git clone https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot.git
cd fee-aware-moonshot-bot
```

### 1c. Run Setup Script

```bash
chmod +x deployment/vps/setup.sh
./deployment/vps/setup.sh
```

This will:
- Update system packages
- Install Node.js v20
- Install PM2 globally
- Install npm dependencies
- Build TypeScript
- Create data directories
- Generate .env.example

### 1d. Configure Environment

Edit the `.env` file with your credentials:

```bash
nano .env
```

Required variables:
```env
# Get from BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_token_here

# Your Telegram ID (get from @userinfobot)
TELEGRAM_ADMIN_ID=123456789

# Solana RPC (free endpoint provided)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# OpenAI API key (optional for AI monitoring)
OPENAI_API_KEY=sk-...

# Trading settings
LIVE_TRADING_ENABLED=false  # Set to true only when ready!
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

## Step 2: Deploy & Start

### Option A: PM2 (Recommended - No Docker)

```bash
npm run pm2:start
```

Benefits:
- Easy to start/stop
- Auto-restart on crash
- Built-in monitoring
- No Docker overhead

### Option B: Docker (If installed)

```bash
docker-compose -f deployment/docker/docker-compose.yml up -d
```

Benefits:
- Completely isolated
- Easy to update
- Better for shared hosting
- Automatic resource limits

### Option C: Manual (Not recommended for 24/7)

```bash
npm run build
npm start
```

## Step 3: Verify Deployment

### Check if running

```bash
# Using PM2
pm2 list

# Or check directly
curl http://localhost:3000/health
```

### Monitor logs

```bash
# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f moonshot-bot
```

### Expected output

```
[2026-03-28T18:01:01.599Z] INFO [orchestrator] All systems initialized
[2026-03-28T18:01:01.599Z] INFO [orchestrator] Trading polling started
[2026-03-28T18:01:01.599Z] INFO [orchestrator] Bot Orchestrator started successfully
```

## Step 4: Enable 24/7 Uptime

### PM2 Startup (Recommended)

```bash
# Enable auto-start on server reboot
pm2 startup
pm2 save

# Verify
pm2 create-startup
```

### Docker Auto-Restart

Already configured in `docker-compose.yml`:
```yaml
restart: always
```

### Systemd Service (Alternative)

Create `/etc/systemd/system/moonshot-bot.service`:

```ini
[Unit]
Description=Fee-Aware Moonshot Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/fee-aware-moonshot-bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
User=root

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable moonshot-bot
sudo systemctl start moonshot-bot
```

## Step 5: Configure Telegram Users

Users register through the Telegram bot with `/register` command:

1. They choose import or generate wallet
2. Bot securely stores their wallet
3. They can immediately start trading
4. All data isolated per user

### Admin Commands (For you)

```
/admin_status    - See all active users
/admin_config    - Change bot settings
/admin_restart   - Safely restart bot
```

## Step 6: Monitoring & Maintenance

### Daily Health Check

```bash
../deployment/vps/health-check.sh
```

Or from cron (daily at 8 AM):

```bash
0 8 * * * /root/fee-aware-moonshot-bot/deployment/vps/health-check.sh >> /root/fee-aware-moonshot-bot/logs/health.log 2>&1
```

### Weekly Backups

```bash
../deployment/vps/backup.sh
```

Or auto-backup (weekly on Sunday):

```bash
0 2 * * 0 /root/fee-aware-moonshot-bot/deployment/vps/backup.sh
```

### Monitor Resource Usage

```bash
# Memory/CPU
pm2 monit

# Disk space
df -h

# Database size
du -h data/trades.db
```

## Troubleshooting

### Bot won't start

1. Check logs: `pm2 logs`
2. Verify .env is set: `cat .env | grep TELEGRAM`
3. Check Telegram token is valid
4. Restart: `pm2 restart fee-aware-moonshot-bot`

### API not responding

```bash
curl -v http://localhost:3000/health
```

If timeout:
- Check firewall: `sudo ufw status`
- Check CPU/Memory: `pm2 monit`
- Restart: `pm2 restart fee-aware-moonshot-bot`

### Database locked

Database is corrupted:
```bash
# Backup old one
cp data/trades.db data/trades.db.bak

# Let bot recreate
pm2 restart fee-aware-moonshot-bot
```

### High memory usage

```bash
# Check what's using memory
ps aux | sort -nrk 4,4 | head -10

# Restart with memory limit
pm2 stop fee-aware-moonshot-bot
pm2 start deployment/pm2/ecosystem.config.js
```

## Updates & Redeployment

### Pull latest code

```bash
git pull origin main
./deployment/vps/deploy.sh
```

This safely restarts with new code.

### Manual update

```bash
npm install
npm run build
pm2 restart fee-aware-moonshot-bot
```

## Security Checklist

- ✅ Private keys encrypted in database
- ✅ .env file not committed to git
- ✅ SSH key-based authentication enabled
- ✅ Firewall configured (only ports 22, 80, 443, 3000)
- ✅ Regular backups enabled
- ✅ Log monitoring active
- ✅ HTTPS/SSL configured (with Nginx reverse proxy)

## Accessing Dashboard

If configured with Nginx reverse proxy:

```
https://yourdomain.com
```

API:
```
https://yourdomain.com/api
```

Telegram:
```
@MoonShotForge_bot
```

## Support & Logs

### View all logs

```bash
pm2 logs fee-aware-moonshot-bot --lines 100
```

### Real-time monitoring

```bash
watch -n 1 'pm2 list'
```

### Archive logs

```bash
cd logs
tar -czf archive_$(date +%Y%m%d).tar.gz *.log*
```

---

**Status: ✅ Ready for Production**

Your bot is now running 24/7 on your VPS!
