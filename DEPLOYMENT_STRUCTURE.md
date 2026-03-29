# Production Deployment Structure

This directory contains all the files needed for production VPS deployment.

## Directory Structure

```
deployment/
├── docker/                 # Docker containerization
│   ├── Dockerfile         # Container build config
│   ├── docker-compose.yml # Multi-container orchestration
│   └── .dockerignore      # Files to exclude from build
│
├── pm2/                   # PM2 process management
│   ├── ecosystem.config.js # PM2 configuration
│   └── startup.sh         # Startup script for PM2
│
├── vps/                   # VPS deployment scripts
│   ├── deploy.sh          # Main deployment script
│   ├── setup.sh           # Initial VPS setup
│   ├── health-check.sh    # System health check
│   ├── restart.sh         # Safe restart script
│   └── backup.sh          # Database/config backup
│
├── nginx/                 # Nginx reverse proxy
│   ├── nginx.conf         # Main configuration
│   └── ssl.conf           # SSL/TLS setup
│
├── monitoring/            # Health & monitoring
│   ├── health-check.ts    # Health check endpoint
│   └── monitoring.md      # Monitoring guide
│
└── docs/                  # Documentation
    ├── SETUP.md           # Initial setup guide
    ├── DEPLOYMENT.md      # Step-by-step deployment
    ├── TROUBLESHOOTING.md # Common issues
    └── OPERATIONS.md      # Daily operations
```

## Quick Start (VPS)

### 1. Initial Setup (One-time)
```bash
cd deployment/vps
chmod +x setup.sh deploy.sh health-check.sh
./setup.sh
```

### 2. Deploy Application
```bash
./deploy.sh
```

### 3. Check Health
```bash
./health-check.sh
```

### 4. Monitor Operations
```bash
pm2 logs
pm2 monit
```

## Environment Variables

Create `.env` file in project root:
```
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_ID=your_admin_id

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# OpenAI
OPENAI_API_KEY=your_api_key
OPENAI_ORG_ID=your_org_id

# API Server
API_PORT=3000
API_HOST=0.0.0.0

# Database
DB_PATH=/data/trades.db

# Trading
LIVE_TRADING_ENABLED=false

# Monitoring
LOG_LEVEL=info
```

## Deployment Methods

### Method 1: Docker (Recommended for VPS)
```bash
docker-compose -f deployment/docker/docker-compose.yml up -d
```

### Method 2: PM2 (For Linux VPS without Docker)
```bash
npm run pm2:start
```

### Method 3: Manual npm
```bash
npm install
npm run build
npm start
```

## 24/7 Uptime Setup

### Using PM2 (Linux/Mac)
1. Install PM2: `npm install -g pm2`
2. Enable PM2 startup: `pm2 startup`
3. Save process list: `pm2 save`
4. View status: `pm2 list`

### Using Docker
1. Set `restart: always` in docker-compose.yml
2. Use `docker-compose up -d` to start
3. Monitor with `docker-compose logs -f`

### Using Systemd (Linux)
Create `/etc/systemd/system/moonshot-bot.service`:
```ini
[Unit]
Description=Fee-Aware Moonshot Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/moonshot-bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable moonshot-bot`

## Monitoring & Logging

### Real-time Logs
```bash
# PM2
pm2 logs

# Docker
docker-compose logs -f

# Systemd
journalctl -u moonshot-bot -f
```

### Log Rotation
Logs are automatically rotated in `/logs` directory with:
- Daily rotation
- 30-day retention
- Max file size: 10MB

## Security

1. ✅ Private keys encrypted in database
2. ✅ API protected with CORS
3. ✅ Helmet security headers
4. ✅ Rate limiting on endpoints
5. ✅ Input validation
6. ✅ Environment variables for secrets

## Scaling

For high throughput:
1. Use containerized setup with load balancing
2. Configure multiple PM2 instances
3. Use Redis for session caching
4. Monitor CPU/Memory usage

## Support

- Health endpoint: `http://localhost:3000/health`
- Logs: `logs/` directory
- Error tracking: Check Telegram notifications

Status: ✅ Ready for Production Deployment
