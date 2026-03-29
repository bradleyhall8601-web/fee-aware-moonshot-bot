# 🎯 Telegram Bot - Localhost Monitoring & Testing Guide

## Status: ✅ TELEGRAM BOT IS WORKING

Your Telegram bot is **fully operational** and receiving messages from users. The bot:
- ✅ Connects to Telegram servers successfully
- ✅ Receives and processes user messages in real-time
- ✅ Handles callback buttons and registration flow
- ✅ Supports multi-user simultaneous registration
- ✅ Logs all activity with full debug information

---

## 📡 Localhost API Endpoints

Access these endpoints on your machine to monitor bot activity in real-time:

### 1. **Bot Status Dashboard**
```
GET http://localhost:3000/api/system/status
```
Returns real-time bot metrics:
- Active users count
- Open/closed trades
- Memory usage
- Uptime

**Example Response:**
```json
{
  "uptime": 14917.28,
  "memory": {
    "rss": 61566976,
    "heapTotal": 28401664,
    "heapUsed": 26223376
  },
  "activeUsers": 0,
  "activeTrades": 0,
  "totalTrades": 0,
  "totalProfit": 0
}
```

### 2. **Debug Status Page**
```
GET http://localhost:3000/debug/status
```
Complete system diagnostics:
- Node.js version
- Platform info
- Telegram token status
- All available endpoints

### 3. **Telegram Debug Info**
```
GET http://localhost:3000/debug/telegram
```
Real-time Telegram bot activity:
- All registered users
- Recent message logs
- Callback activity
- Command processing history

---

## 📊 How to Monitor in Real-Time

### Option 1: PowerShell Loop (Windows)
```powershell
while ($true) {
    Write-Host "🔄 Fetching bot status..."
    $response = Invoke-WebRequest -Uri http://localhost:3000/api/system/status -UseBasicParsing | ConvertFrom-Json
    
    Write-Host "Bot Status:"
    Write-Host "  Active Users: $($response.activeUsers)"
    Write-Host "  Open Trades: $($response.activeTrades)"
    Write-Host "  Total Profit: $$($response.totalProfit)"
    Write-Host "  Uptime: $([math]::Round($response.uptime, 2))s"
    Write-Host ""
    
    Start-Sleep -Seconds 5
}
```

### Option 2: Browser Tab
Open in Google Chrome/Edge:
```
http://localhost:3000/debug/status
```
Then install an auto-refresh extension (e.g., "Auto Refresh Plus") to see live updates.

### Option 3: Command Line Watch
```powershell
# Run this to continuously check status
while ($true) { Clear-Host; Invoke-WebRequest -Uri http://localhost:3000/api/system/status -UseBasicParsing | ConvertFrom-Json | ForEach-Object { Write-Host "Users: $($_.activeUsers) | Trades: $($_.activeTrades) | Profit: $$($_.totalProfit)" }; Start-Sleep 3 }
```

---

## 🎬 Test Telegram Yourself

Your bot token is configured and active. Send a message to the bot on Telegram:

**Bot Username:** `@MoonShotForge_bot`

**Test Commands:**
```
/start          - Start the bot
/register       - Register your wallet
/help           - Show help menu
/status         - View trading status
/config         - View configuration
```

**Expected Flow:**
1. User sends `/start`
2. Bot responds with welcome message
3. User clicks "Register Now" button
4. Bot guides through wallet setup (import or generate)
5. User completes registration
6. Bot is ready for trading

**Check Real-Time Logs:**
Open terminal and see console output like:
```
📨 [TELEGRAM] Update from @username (12345678): message
💬 [TELEGRAM DEBUG] @username (12345678): Text message
[TEXT] Received from 12345678: "/register"
✅ [TELEGRAM] User registered successfully
```

---

## 🐛 Debug Logging

### Console Output
The bot prints detailed debug info with emojis:
```
🔧 [TELEGRAM] Initializing with token: 8437765648...
🚀 [TELEGRAM] Launching bot...
📨 [TELEGRAM] Update from @username (12345): message
💬 [TELEGRAM DEBUG] @username (12345): Text: /start
⚡ [TELEGRAM] Start command from @username (12345)
[START] Processing /start for user 12345
✅ [TELEGRAM] Bot ready. Loaded 2 existing users
```

### File Location
All logs are also stored in:
- **Windows:** `C:\Users\bradl\Desktop\fee-aware-moonshot-bot\logs\`
- **VPS:** `/home/user/fee-aware-moonshot-bot/logs/`

---

## 🚀 Next Steps

### Deploy to VPS
Once testing is complete locally:
```bash
npm run pm2:start           # Start with PM2
npm run docker:up           # Or use Docker
./deployment/vps/setup.sh   # Or run VPS setup script
```

### Monitor VPS
SSH into your server and run:
```bash
npm run pm2:logs            # View PM2 logs
pm2 monit                   # Real-time resource monitoring
curl http://localhost:3000/api/system/status  # Check status
```

### Performance Tuning
If memory grows over time:
- Check `/api/system/logs` for errors
- Restart with: `npm run pm2:restart`
- Enable garbage collection: `node --expose-gc dist/index.js`

---

## ❓ Troubleshooting

### Issue: "Cannot GET /debug/telegram"
**Solution:** Wait for bot to fully initialize (watch for "Bot ready" message in console)

### Issue: No users showing up
**Solution:** Telegram is only added when users successfully complete `/register`

### Issue: Bot not responding to Telegram messages
**Solution:** 
1. Check bot token in `.env` file
2. Verify token is correct from BotFather
3. Check console for error messages
4. Restart bot: `npm run dev`

### Issue: High memory usage
**Solution:**
1. Restart bot daily with: `npm run pm2:restart`
2. Enable garbage collection
3. Reduce log history size
4. Monitor with: `pm2 monit`

---

## 📋 Bot Architecture

```
┌─────────────────────────────────────┐
│  Telegram Users (Telegram App)      │
└────────────┬────────────────────────┘
             │ Messages & Callbacks
             ↓
┌─────────────────────────────────────┐
│  Telegram Bot (@MoonShotForge_bot)  │
├─────────────────────────────────────┤
│ • telegram-multi.ts                 │
│ • telegram-registration.ts          │
│ • telegram-debug.ts                 │
└────────────┬────────────────────────┘
             │ 
             ↓
┌─────────────────────────────────────┐
│  Bot Orchestrator                   │
├─────────────────────────────────────┤
│ • User Management                   │
│ • Trading Engine                    │
│ • Database (SQLite)                 │
│ • API Server (Port 3000)            │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  Localhost Monitoring (Port 3000)   │
├─────────────────────────────────────┤
│ GET /api/system/status              │
│ GET /debug/telegram                 │
│ GET /debug/status                   │
│ GET /health                         │
└─────────────────────────────────────┘
```

---

## 📝 Configuration

**Active Config (.env):**
```env
TELEGRAM_BOT_TOKEN=8437765648:AAHdBwyT20hCT4JT4CqPIkfnd9K1zYgPhr8
NODE_ENV=production
ENABLE_LIVE_TRADING=false  (Paper mode testing)
API_PORT=3000
```

**Debug Settings:**
All Telegram messages are logged with:
- User ID
- Username  
- Message/Callback content
- Timestamp
- Processing result

---

## ✨ You're All Set!

✅ Telegram bot is working perfectly
✅ Localhost monitoring is active  
✅ All debug endpoints are responding
✅ Ready for multi-user production deployment

**Next:** Send a message to `@MoonShotForge_bot` on Telegram to test it live!
