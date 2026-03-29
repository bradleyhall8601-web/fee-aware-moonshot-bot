# Fee-Aware Moonshot Bot - Replit Deployment Guide

This project is configured to run on Replit. Follow these steps to get started:

## Quick Start

1. **Fork to Replit**: Click the "Fork" button to create your own Replit project
2. **Set Environment Variables**: Add your Telegram bot token:
   - `TELEGRAM_BOT_TOKEN` - Get from @BotFather on Telegram
3. **Run**: Click the "Run" button to start the bot

## Environment Variables

Create a `.env` file or set these in Replit Secrets:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional
NODE_ENV=production
DEBUG=false
ENABLE_LIVE_TRADING=false
ENABLE_AI_MONITOR=false
```

## Features Enabled

✅ Multi-user Telegram bot
✅ Paper trading (safe mode)
✅ SQLite database
✅ API server on port 3000
✅ Health check endpoint

## Testing the Bot

1. Send `/start` to your bot on Telegram
2. Register a new user with `/register`
3. Choose wallet setup method
4. Access status with `/status`

## Troubleshooting

- **Bot not responding**: Check that TELEGRAM_BOT_TOKEN is set correctly
- **Port already in use**: Replit assigns a unique port automatically
- **Database errors**: The bot creates data/bot.db automatically

## Deployment

### Paper Trading (Default - Safe)
```bash
ENABLE_LIVE_TRADING=false
```

### Live Trading (Requires Real Funds)
```bash
ENABLE_LIVE_TRADING=true
```

## Health Check

Visit the health endpoint:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "ok": true,
  "mode": "multi-user-production",
  "system": { ... }
}
```

## Documentation

- [QUICK_START_5MIN.md](./QUICK_START_5MIN.md) - 5-minute quickstart
- [PRODUCTION_READY.md](./PRODUCTION_READY.md) - Full deployment guide
- [USER_EXPERIENCE.md](./USER_EXPERIENCE.md) - User journey guide

## Next Steps

1. Test registration flow
2. Configure trading parameters
3. Monitor bot activity in logs
4. Enable live trading after verification

Happy trading! 🚀
