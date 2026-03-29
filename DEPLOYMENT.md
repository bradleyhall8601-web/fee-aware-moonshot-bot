# VPS Deployment Guide - Fee-Aware Moonshot Bot

## Overview

This guide covers deploying the multi-user Solana trading bot to a VPS with AI monitoring, multi-user support, and automatic maintenance notifications.

## System Requirements

- **OS**: Ubuntu 20.04 LTS or newer (or equivalent Linux)
- **CPU**: 2+ cores recommended
- **RAM**: 2GB minimum, 4GB+ recommended
- **Storage**: 20GB+ SSD
- **Network**: Fast, stable internet connection

## Step 1: Initial VPS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required tools
sudo apt install -y \
  git \
  curl \
  wget \
  nodejs npm \
  python3-dev \
  build-essential \
  docker.io \
  docker-compose

# Add user to docker group (optional, for non-root use)
sudo usermod -aG docker $USER

# Verify installations
node --version
npm --version
docker --version
```

## Step 2: Clone Repository

```bash
# Navigate to desired directory
cd /opt

# Clone the repository
git clone https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot.git
cd fee-aware-moonshot-bot

# Set proper permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

## Step 3: Configuration

### Option A: Using Docker (Recommended)

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# Key variables to set:
# TELEGRAM_BOT_TOKEN=your_token_here
# OPENAI_API_KEY=sk-your-key-here
# ENABLE_LIVE_TRADING=false (start in paper mode)
```

### Option B: Native Node.js Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Copy environment
cp .env.example .env

# Edit config
nano .env
```

## Step 4: Telegram Bot Setup

1. **Create Telegram Bot**:
   ```
   Open Telegram and search for @BotFather
   Send: /newbot
   Follow instructions
   Copy the Bot Token
   ```

2. **Get Your Chat ID** (for alerts):
   ```
   Open Telegram and search for @userinfobot
   Start the bot
   It will show your numeric user ID
   ```

3. **Update .env file**:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABCDefGHIjklmnoPqrsTUVwxyz...
   ```

## Step 5: OpenAI API Setup (for AI Monitoring)

1. Create account at [openai.com](https://openai.com)
2. Generate API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
3. Add to .env:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

## Step 6: Deployment

### Using Docker Compose (Easiest)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f bot

# Check status
docker-compose ps

# Stop
docker-compose down
```

### Using PM2 (Manual)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Auto-start on reboot
pm2 startup
pm2 save
```

### Systemd Service (Advanced)

```bash
# Create service file
sudo nano /etc/systemd/system/moonshot-bot.service

# Add content:
[Unit]
Description=Fee-Aware Moonshot Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/fee-aware-moonshot-bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:/opt/fee-aware-moonshot-bot/logs/bot.log
StandardError=append:/opt/fee-aware-moonshot-bot/logs/error.log

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable moonshot-bot
sudo systemctl start moonshot-bot

# Monitor
sudo systemctl status moonshot-bot
sudo journalctl -u moonshot-bot -f
```

## Step 7: Firewall Setup

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP (for web dashboard, if applicable)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## Step 8: SSL/HTTPS Setup (for dashboard)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

## Step 9: Monitoring & Maintenance

### Health Check

```bash
# Manual health check
npm run health

# Automated (in docker):
# Health checks built into docker-compose.yml
```

### View Logs

```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs

# System logs
tail -f /opt/fee-aware-moonshot-bot/logs/bot-$(date +%Y-%m-%d).log
```

### Database Backup

```bash
# Backup SQLite database
cp data/bot.db backups/bot.db.$(date +%Y%m%d-%H%M%S)

# Backup logs
tar czf backups/logs-$(date +%Y%m%d).tar.gz logs/
```

## Step 10: User Management

### Registering Users in Telegram

1. Users start the bot: `/start`
2. Click "Register Now"
3. Send wallet address
4. Send private key (securely)
5. Bot configured and ready!

### Managing Users

```bash
# View all active users
npm run health

# Access database
sqlite3 data/bot.db

# Query users
SELECT * FROM users;
SELECT * FROM user_configs;
```

## Troubleshooting

### Bot Won't Start

```bash
# Check logs
docker-compose logs bot
pm2 logs

# Verify environment
npm run health

# Check Telegram token
grep TELEGRAM_BOT_TOKEN .env
```

### Out of Memory

```bash
# Increase memory limit (Docker)
# Edit docker-compose.yml:
memory: 1g
memswap_limit: 2g

# For Node.js
export NODE_OPTIONS="--max-old-space-size=1024"
npm start
```

### Database Lock Issues

```bash
# Restart bot (clears locks)
docker-compose restart bot
# or
pm2 restart fee-aware-moonshot-bot
```

### AI Monitor Not Responding

1. Check OpenAI API key
2. Verify API credit balance
3. Check rate limits
4. Review logs for errors

## Performance Tuning

### Production Settings

```bash
# .env optimizations
ENABLE_LIVE_TRADING=false        # Start in paper mode
POLL_INTERVAL_MS=5000            # 5 second polls
MONITOR_INTERVAL_MS=30000        # 30 second monitoring
NODE_ENV=production
DEBUG=false
```

### Memory Management

```bash
# Docker approach
memory: 1g
memswap_limit: 2g

# Node.js approach
export NODE_OPTIONS="--max-old-space-size=1024"
```

## Scaling (Multiple Instances)

For running multiple instances:

```bash
# Docker Compose scaling
docker-compose up -d --scale bot=3

# Or use Docker Swarm / Kubernetes for production
```

## Backup Strategy

```bash
# Daily backups
0 2 * * * /opt/fee-aware-moonshot-bot/scripts/backup.sh

# Backup script
#!/bin/bash
BACKUP_DIR="/backups/bot"
mkdir -p $BACKUP_DIR
cp data/bot.db $BACKUP_DIR/bot.db.$(date +%Y%m%d)
tar czf $BACKUP_DIR/logs-$(date +%Y%m%d).tar.gz logs/
# Upload to cloud storage
aws s3 cp $BACKUP_DIR/ s3://my-bucket/backups/ --recursive
```

## Security Best Practices

1. **Private Keys**: Always use encrypted storage in production
2. **API Keys**: Use environment variables, never hardcode
3. **Database**: Regularly backup and encrypt
4. **Firewall**: Restrict access to necessary ports only
5. **SSH**: Use key-based authentication
6. **Secrets**: Use a secrets management system (e.g., HashiCorp Vault)

## Support & Updates

```bash
# Check for updates
git pull origin main

# Rebuild after updates
npm install
npm run build

# Restart services
docker-compose down
docker-compose up -d
```

## Emergency Procedures

### Immediate Shutdown (if issues)

```bash
# Docker
docker-compose down

# PM2
pm2 stop fee-aware-moonshot-bot

# Systemd
sudo systemctl stop moonshot-bot
```

### Revert to Previous Version

```bash
git log --oneline
git checkout <commit-hash>
npm install && npm run build
# Restart service
```

### Manual Database Reset

```bash
# WARNING: This deletes all data!
rm data/bot.db
npm start  # Will recreate
```

## Monitoring Dashboard (Optional)

For additional monitoring, consider:

- **PM2 Plus**: Enhanced PM2 monitoring
- **DataDog**: APM and infrastructure monitoring
- **New Relic**: Application performance monitoring
- **Grafana**: Custom dashboards with Prometheus

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Project Repository](https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot)
- Telegram: @support_bot
