# Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment

### Code & Build
- [ ] `npm run build` - Build completes without errors
- [ ] `npm run health` - Health check passes
- [ ] `git status` - All changes committed
- [ ] `.env.example` updated with all variables
- [ ] No sensitive data in code

### Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `TELEGRAM_BOT_TOKEN` set and tested
- [ ] `OPENAI_API_KEY` set (if using AI monitoring)
- [ ] `ENABLE_LIVE_TRADING=false` (start in paper mode)
- [ ] `NODE_ENV=production` set
- [ ] `DEBUG=false` set

### Infrastructure
- [ ] VPS provisioned (2+ cores, 2+ GB RAM recommended)
- [ ] Ubuntu 20.04+ or equivalent Linux
- [ ] SSH access verified
- [ ] Firewall rules configured (22, 80, 443)
- [ ] Backup strategy planned

### Telegram Setup
- [ ] Bot created via @BotFather
- [ ] Bot token copied to `.env`
- [ ] Bot test message sent successfully
- [ ] Chat welcome command works

### Database
- [ ] Database directory exists: `data/`
- [ ] Backup strategy implemented
- [ ] Database user permissions set correctly

## Deployment

### Docker Deployment
- [ ] Docker installed on VPS
- [ ] Docker Compose installed
- [ ] `docker-compose.yml` reviewed
- [ ] `Dockerfile` reviewed
- [ ] `.dockerignore` set up properly
- [ ] Image builds successfully: `docker build -t moonshot-bot .`
- [ ] Container starts: `docker-compose up -d`
- [ ] Health check passes: `docker-compose ps`

### PM2 Deployment
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] `ecosystem.config.js` configured for VPS
- [ ] `npm run build` successful
- [ ] `pm2 start ecosystem.config.js` successful
- [ ] `pm2 status` shows running
- [ ] `pm2 startup` configured
- [ ] Logs accessible via `pm2 logs`

### Systemd Deployment
- [ ] Service file created: `/etc/systemd/system/moonshot-bot.service`
- [ ] Service enabled: `systemctl enable moonshot-bot`
- [ ] Service started: `systemctl start moonshot-bot`
- [ ] Status verified: `systemctl status moonshot-bot`
- [ ] Logs accessible: `journalctl -u moonshot-bot -f`

## Post-Deployment

### Initial Testing
- [ ] Bot starts successfully
- [ ] Logs show normal operation
- [ ] Telegram bot responds to `/start`
- [ ] User can register via Telegram
- [ ] `/status` command works
- [ ] Health check returns 200 status

### Monitoring
- [ ] Log files created and updating
- [ ] Memory usage stable (<500MB)
- [ ] CPU usage stable (<50%)
- [ ] Database backups working
- [ ] Error logs reviewed
- [ ] No critical errors in first hour

### User Access
- [ ] Users can start bot: `/start`
- [ ] Users can register wallet: `/register`
- [ ] Registration process completes
- [ ] User configuration saved
- [ ] `/status` shows user data

### Paper Mode Testing
- [ ] Paper mode trades simulated (not executed)
- [ ] Telegram notifications sending correctly
- [ ] Trade logs appearing in database
- [ ] Performance metrics calculating
- [ ] No real funds being used

### Failover Testing
- [ ] Graceful shutdown works (Ctrl+C)
- [ ] Auto-restart configured
- [ ] Auto-restart tested successfully
- [ ] Recent logs preserved after restart
- [ ] Database integrity maintained

## Security Verification

### Environment
- [ ] No private keys in code or .env committed to git
- [ ] Environment variables properly secured
- [ ] Database file permissions restrictive (600 or 640)
- [ ] Logs directory permissions correct
- [ ] SSH keys secured

### Secrets Management
- [ ] `TELEGRAM_BOT_TOKEN` not logged or exposed
- [ ] `OPENAI_API_KEY` not logged or exposed
- [ ] Private keys encrypted (TODO in production)
- [ ] Database backed up
- [ ] Secrets not in Docker images

### Access Control
- [ ] Firewall restricts SSH access
- [ ] Only necessary ports open
- [ ] DDoS protection (if available from provider)
- [ ] Rate limiting configured
- [ ] Log access restricted

## Ongoing Maintenance

### Daily
- [ ] Check bot is running: `pm2 status`
- [ ] Review error logs: `tail -f logs/bot-*.log`
- [ ] Monitor memory/CPU, ensure stable

### Weekly
- [ ] Backup database: `cp data/bot.db backups/`
- [ ] Review performance metrics
- [ ] Check for updates: `git pull origin main`
- [ ] Review Telegram user feedback

### Monthly
- [ ] Update dependencies with security patches
- [ ] Test disaster recovery procedure
- [ ] Review access logs
- [ ] Audit user wallets and permissions
- [ ] Rotate API keys if necessary

## Scaling Checklist

When ready to scale to multiple instances:

- [ ] Load balancer configured
- [ ] Shared PostgreSQL database set up (instead of SQLite)
- [ ] Database migrations tested
- [ ] Multiple bot instances configured
- [ ] Telegram webhook vs polling optimized
- [ ] Cache layer added if needed

## Rollback Procedure

If deployment fails or needs rollback:

```bash
# Stop current instance
pm2 stop fee-aware-moonshot-bot

# Restore previous version
git checkout <previous-commit-hash>
npm install
npm run build

# Verify before restart
npm run health

# Restart
pm2 start ecosystem.config.js

# Verify running
pm2 logs
```

## Contact & Escalation

- **Admin Contact**: [Your contact info]
- **On-Call Schedule**: [Link to schedule]
- **Emergency Hotline**: [Phone number]
- **Escalation Policy**: [Link to policy]

---

## Sign-Off

- **Deployed By**: __________________ Date: __________
- **Approved By**: __________________ Date: __________
- **Verified By**: __________________ Date: __________

**Status**: 
- [ ] DEPLOYED 
- [ ] FAILED (Reason: ___________________________________)
