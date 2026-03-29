# 🚀 QUICK START - 5 MINUTES TO PRODUCTION

**Everything is ready. Here's how to get online in 5 minutes.**

## Pre-Requisites (Have These Ready)

```
✓ Telegram Bot Token (from BotFather: @BotFather)
✓ Your Telegram Admin ID (from @userinfobot)
✓ VPS with 2GB+ RAM (or your local machine)
✓ SSH access (if using VPS)
```

## Option A: PM2 on Linux VPS (RECOMMENDED)

### 1. Connect to VPS
```bash
ssh your_user@your_vps_ip
```

### 2. Clone & Setup (3 minutes)
```bash
git clone https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot.git
cd fee-aware-moonshot-bot
chmod +x deployment/vps/*.sh
./deployment/vps/setup.sh
```

### 3. Configure `.env` (1 minute)
```bash
nano .env
```

Update these lines:
```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_ADMIN_ID=your_admin_id
OPENAI_API_KEY=sk-your_key_here (optional)
```

Press `Ctrl+X`, then `Y`, then `Enter`

### 4. Start Bot (1 minute)
```bash
npm run pm2:start
```

### 5. Verify Running
```bash
pm2 logs
```

Look for: `All systems initialized` ✅

**DONE! Bot is live 24/7! 🎉**

---

## Option B: Docker

### 1. Clone & Configure
```bash
git clone https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot.git
cd fee-aware-moonshot-bot
cp .env.example .env
nano .env  # Update credentials
```

### 2. Start Docker
```bash
docker-compose -f deployment/docker/docker-compose.yml up -d
```

### 3. Check Logs
```bash
docker-compose logs -f moonshot-bot
```

**DONE! 🎉**

---

## Option C: Local Development (Testing)

```bash
npm install
npm run build
npm start
```

Then:
- Telegram: @MoonShotForge_bot
- API: http://localhost:3000

---

## ✅ How to Know It's Working

### Check 1: Process Running
```bash
# If using PM2
pm2 list

# You should see: fee-aware-moonshot-bot online
```

### Check 2: Health Endpoint
```bash
curl http://localhost:3000/health
# Response: {"status":"healthy"}
```

### Check 3: Telegram Bot
1. Search for `@MoonShotForge_bot` on Telegram
2. Send `/start`
3. Should see welcome message

### Check 4: Logs
```bash
pm2 logs
```

Should show:
```
[2026-03-28] All systems initialized
[2026-03-28] Bot Orchestrator started successfully
```

---

## 📝 User Registration Flow

Your users will:

1. Find bot: `@MoonShotForge_bot`
2. Send `/start`
3. Click "Register Now"
4. Enter username → `trader_pro`
5. Choose wallet → "Generate New"
6. Click "Confirm"
7. Registration complete! ✅

They can now trade immediately.

---

## 🔧 Common Commands

### Monitor
```bash
pm2 logs              # See real-time logs
pm2 monit             # CPU/Memory monitor
pm2 list              # All processes
```

### Manage
```bash
pm2 restart all       # Restart bot
pm2 stop all          # Stop bot
pm2 delete all        # Remove bot
```

### Update
```bash
git pull origin main
npm run deploy
```

### Backup
```bash
./deployment/vps/backup.sh
```

### Health Check
```bash
./deployment/vps/health-check.sh
```

---

## 🚨 Troubleshooting

### Bot won't start?
```bash
npm run build          # Rebuild
pm2 restart all        # Restart
pm2 logs               # Check errors
```

### API not responding?
```bash
pm2 list               # Check if running
curl localhost:3000    # Test directly
```

### Users can't register?
Check logs for errors:
```bash
pm2 logs | grep -i error
grep TELEGRAM .env     # Verify token
```

### Database issue?
```bash
# Restore from backup
cp data/backups/trades_latest.db.gz data/
gunzip data/trades_latest.db.gz
pm2 restart all
```

---

## 📊 What's Included

✅ Secure multi-user system
✅ Private wallet management
✅ Telegram registration flow
✅ Automatic backups
✅ 24/7 uptime monitoring
✅ Error auto-recovery
✅ Real-time logging
✅ Health checks

---

## 📚 Learn More

**Main guides:**
- `PRODUCTION_READY.md` - Complete guide
- `FOLDER_STRUCTURE.md` - Directory walkthrough
- `USER_EXPERIENCE.md` - What users see

**VPS guides:**
- `deployment/docs/SETUP.md` - Step-by-step
- `deployment/docs/CHECKLIST.md` - Before production
- `deployment/docs/USER_REGISTRATION.md` - User guide

---

## 🎉 You're Live!

In 5 minutes you have:

✅ Production bot running 24/7
✅ Users can register via Telegram
✅ Each user has their own wallet
✅ Automatic backups running
✅ Health monitoring active
✅ All systems working synchronously
✅ Zero errors

**Your bot is LIVE and trading! 🚀**

---

## Support

- **Issues?** Check `pm2 logs`
- **Setup help?** Read `deployment/docs/SETUP.md`
- **User issues?** See `deployment/docs/USER_REGISTRATION.md`
- **Architecture?** See `FOLDER_STRUCTURE.md`

**Everything is documented. Everything is tested. Everything works.**

---

**Status: PRODUCTION READY ✅**

You're now live on a VPS with 24/7 uptime! 🎉
