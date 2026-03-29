# COMPLETE DEPLOYMENT GUIDE

**Fee-Aware Moonshot Bot v2.0 - Full Production Deployment**

This guide covers all deployment options: local development, Docker containerization, and VPS production deployment with CI/CD automation.

---

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [VPS Production Deployment](#vps-production-deployment)
4. [GitHub CI/CD Pipeline](#github-cicd-pipeline)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org))
- npm 9+
- Git
- Python 3 (for some dependencies)

### Setup

```bash
# Clone repository
git clone <your-repo-url>
cd fee-aware-moonshot-bot

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your settings
nano .env  # or use your favorite editor
```

### Environment Variables Required

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI (for AI monitoring)
OPENAI_API_KEY=your_openai_api_key

# Database (optional - uses SQLite by default)
# DATABASE_URL=sqlite:./data/bot.db

# Trading Configuration
ENABLE_LIVE_TRADING=false  # Set to true when ready!
POLL_INTERVAL_MS=5000

# API Server
API_PORT=3000

# Encryption
ENCRYPTION_KEY=your_hex_encryption_key_64_chars

# Optional DEX APIs (for real market data)
BIRDEYE_API_KEY=your_birdeye_key
RAYDIUM_API_KEY=your_raydium_key
```

### Running Locally

```bash
# Development mode (with hot reload)
npm run dev

# Build
npm run build

# Production mode
npm start

# Health check
npm run health

# View logs
pm2 logs
```

### Development Workflow

```bash
# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Run tests in watch mode
npm test:watch

# Build and run health check
npm run build && npm run health

# Format code
npm run lint
```

---

## Docker Deployment

### Prerequisites
- Docker ([Install](https://docs.docker.com/get-docker/))
- Docker Compose ([Install](https://docs.docker.com/compose/install/))

### Quick Start

```bash
# Build Docker image
./scripts/deploy-docker.sh build

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Start bot
./scripts/deploy-docker.sh up

# View logs
./scripts/deploy-docker.sh logs

# Stop bot
./scripts/deploy-docker.sh down
```

### Manual Docker Commands

```bash
# Build image
npm run docker:build

# Start with Docker Compose
npm run docker:up

# View logs
npm run docker:logs

# Stop containers
npm run docker:down

# Access container shell
docker-compose exec bot sh

# Restart bot
docker-compose restart bot
```

### Docker Compose Configuration

The `docker-compose.yml` includes:
- **Bot container**: Main application
- **PostgreSQL** (optional): For multi-instance deployments
- **Volume mounts**: Data persistence
- **Health checks**: Automatic restart on failure
- **Logging**: Automatic log rotation

### Pushing to Docker Registry

```bash
# Build image
npm run docker:build

# Login to registry (Docker Hub example)
docker login

# Tag image
docker tag fee-aware-moonshot-bot:latest your-username/fee-aware-moonshot-bot:latest

# Push
docker push your-username/fee-aware-moonshot-bot:latest
```

Or use the automated script:

```bash
# Requires environment variables
export REGISTRY=your-username
./scripts/deploy-docker.sh push
```

---

## VPS Production Deployment

### Recommended Specs
- **OS**: Ubuntu 22.04 LTS or Debian 12
- **CPU**: 2+ cores
- **RAM**: 2GB minimum, 4GB+ recommended
- **Storage**: 20GB SSD minimum
- **Connection**: 100 Mbps+

### Step 1: Initial VPS Setup

```bash
# SSH into VPS
ssh root@your.vps.ip

# Run setup script (as root)
curl -fsSL https://raw.githubusercontent.com/your-repo/setup-vps.sh | bash

# Or manually:
cd fee-aware-moonshot-bot/scripts
sudo bash setup-vps.sh
```

This script will:
- Install Node.js, npm, Git, Docker
- Configure firewall
- Setup application user
- Install PM2 globally

### Step 2: Clone and Configure

```bash
# Switch to application user
sudo su - moonshot

# Clone repository
cd /opt/fee-aware-moonshot-bot
git clone <your-repo-url> .

# Install dependencies
npm ci --production

# Create and configure environment
cp .env.example .env
nano .env  # Edit with your secrets

# Build project
npm run build
```

### Step 3: Start with PM2

```bash
# Start bot using PM2 ecosystem config
npm run pm2:start

# View status
pm2 status

# View logs
pm2 logs fee-aware-moonshot-bot

# Setup auto-restart on reboot
pm2 startup
pm2 save
```

### Step 4: Configure SSL/HTTPS (Recommended)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Configure reverse proxy (optional)
# Setup nginx to proxy :3000 requests
```

### Monitoring Dashboard Access

The bot runs a web dashboard on port 3000:

```
http://your.vps.ip:3000
```

Features:
- Real-time system metrics
- Active user management
- Trading history
- Market analysis
- System logs viewer

### Automated Deployment

Using the deployment script:

```bash
# From your local machine
./scripts/deploy.sh your.vps.ip moonshot /opt/fee-aware-moonshot-bot
```

This will:
1. Build locally
2. Upload to VPS
3. Install dependencies
4. Build on VPS
5. Restart bot with PM2

### Manual Deployment

```bash
# SSH into VPS
ssh moonshot@your.vps.ip

# Go to app directory
cd /opt/fee-aware-moonshot-bot

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Build
npm run build

# Restart bot
npm run pm2:restart

# Verify
npm run health
```

---

## GitHub CI/CD Pipeline

### Setup

1. **Create GitHub repository** with your code
2. **Configure secrets** in GitHub repo settings:
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub token
   - `VPS_HOST`: Your VPS IP address
   - `VPS_USER`: SSH user (default: moonshot)
   - `VPS_SSH_KEY`: Private SSH key for VPS access
   - `VPS_PORT`: SSH port (default: 22)
   - `VPS_APP_PATH`: App path on VPS (default: /opt/fee-aware-moonshot-bot)
   - `SLACK_WEBHOOK`: (optional) For deployment notifications

2. **Workflows** (automatic on push):
   - `.github/workflows/ci.yml`: Build and test
   - `.github/workflows/deploy.yml`: Auto-deploy to VPS

### GitHub Actions Features

**CI Pipeline** (on every push):
- ✅ Installs dependencies
- ✅ Runs TypeScript build
- ✅ Runs test suite
- ✅ Checks code coverage
- ✅ Runs health check
- ✅ Builds Docker image
- ✅ Pushes to Docker Hub (on main branch)

**Deployment Pipeline** (after successful tests on main):
- ✅ SSH into VPS
- ✅ Pulls latest code
- ✅ Installs dependencies
- ✅ Builds project
- ✅ Restarts bot with PM2
- ✅ Verifies health
- ✅ Sends Slack notification

### Testing Workflows

```bash
# Locally test workflow locally (using act)
npm install -g act
act push

# Or use GitHub CLI
gh workflow run ci.yml
```

### Viewing Workflow Status

```
GitHub repo > Actions tab > Select workflow > View run
```

---

## Monitoring & Maintenance

### PM2 Commands

```bash
# View processes
pm2 status

# View real-time logs
pm2 logs fee-aware-moonshot-bot

# View specific log file
pm2 logs fee-aware-moonshot-bot --lines 50

# Save PM2 config
pm2 save

# Resurrect saved processes
pm2 resurrect

# Monitoring dashboard
pm2 monit
```

### System Health

```bash
# Check bot health
npm run health

# Docker health
docker-compose ps

# System metrics
free -h
df -h
ps aux | grep node
```

### Backup & Recovery

```bash
# Backup database
cp data/bot.db data/bot.db.backup.$(date +%s)

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Restore from backup
cp data/bot.db.backup.TIMESTAMP data/bot.db
pm2 restart fee-aware-moonshot-bot
```

### Log Rotation

PM2 automatically rotates logs via pm2-logrotate plugin:

```bash
# View pm2-logrotate config
pm2 conf

# Check rotated logs
ls -lha ~/.pm2/logs/
```

---

## Troubleshooting

### Bot won't start

```bash
# Check error logs
pm2 logs fee-aware-moonshot-bot

# Check environment variables
cat .env | grep TELEGRAM_BOT_TOKEN

# Verify TypeScript build
npm run build

# Run health check
npm run health
```

### High memory usage

```bash
# Check memory usage
free -h
pm2 monit

# Restart bot
pm2 restart fee-aware-moonshot-bot

# Check for memory leaks
pm2 logs | grep -i "memory\|leak"
```

### Trading not working

```bash
# Check Telegram connectivity
<send /status to bot>

# Check API connectivity
curl https://api.raydium.io/

# Check logs for errors
pm2 logs | grep -i "error\|trade"

# Verify TELEGRAM_BOT_TOKEN in .env
cat .env | grep TELEGRAM_BOT_TOKEN
```

### Docker issues

```bash
# View container logs
docker-compose logs bot

# Rebuild image
npm run docker:build

# Restart container
docker-compose restart bot

# Check container health
docker-compose ps
```

### VPS connection issues

```bash
# Test SSH connection
ssh -v moonshot@your.vps.ip

# Check firewall
sudo ufw status
sudo ufw allow 22/tcp  # Allow SSH

# Check port 3000
sudo ss -tlnp | grep 3000
```

### Deployment failures

```bash
# Check GitHub Actions logs
# GitHub repo > Actions > Select failed run > View error

# Check VPS deployment log
pm2 logs deploy

# Verify git remote
git remote -v

# Check SSH key permissions
ls -la ~/.ssh/
chmod 600 ~/.ssh/id_rsa
```

---

## Production Checklist

Before going live:

- [ ] Environment variables configured securely
- [ ] Database backed up
- [ ] SSL/HTTPS configured
- [ ] Firewall properly configured
- [ ] PM2 auto-restart enabled
- [ ] Logs monitored and rotating
- [ ] Telegram bot connected and tested
- [ ] OpenAI API key active
- [ ] Trading disabled initially (ENABLE_LIVE_TRADING=false)
- [ ] Small test trades executed first
- [ ] Monitoring/alerting setup
- [ ] Backup strategy in place
- [ ] GitHub Actions secrets configured
- [ ] VPS auto-scaling configured (if needed)

---

## Support & Resources

- **Documentation**: See README.md
- **GitHub Issues**: Report bugs and features
- **Telegram**: @YourBotHandle for direct communication
- **Discord**: Join community server (if applicable)

---

**Last Updated**: 2026-03-28
**Version**: 2.0.0
**Status**: Production Ready ✅
