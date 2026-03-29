#!/bin/bash

# Safe Restart Script
# Gracefully restart the bot with safety checks

echo "🔄 Graceful Bot Restart"
echo ""

# Check if running
echo "1. Checking if bot is running..."
if command -v pm2 &> /dev/null; then
    STATUS=$(pm2 list | grep -i "fee-aware" | awk '{print $11}')
    echo "  Current status: $STATUS"
fi

echo ""

# Backup current state
echo "2. Backing up database..."
if [ -f "data/trades.db" ]; then
    BACKUP_FILE="data/backups/trades_backup_$(date +%Y%m%d_%H%M%S).db"
    mkdir -p data/backups
    cp data/trades.db "$BACKUP_FILE"
    echo "  ✅ Backup created: $BACKUP_FILE"
fi

echo ""

# Stop gracefully
echo "3. Stopping bot gracefully..."
if command -v pm2 &> /dev/null; then
    pm2 stop fee-aware-moonshot-bot
    sleep 2
    echo "  ✅ Bot stopped"
fi

echo ""

# Rebuild if changes detected
echo "4. Checking for TypeScript changes..."
if [ -f "src/index.ts" ]; then
    npm run build
    echo "  ✅ Build complete"
fi

echo ""

# Start bot
echo "5. Starting bot..."
if command -v pm2 &> /dev/null; then
    npm run pm2:restart
    echo "  ✅ Starting bot..."
    
    # Wait for startup
    sleep 5
    
    # Verify health
    echo ""
    echo "6. Verifying startup..."
    HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null || echo "failed")
    
    if [[ $HEALTH == *"healthy"* ]]; then
        echo "  ✅ Bot started successfully"
    else
        echo "  ⚠️  Bot may not have started properly"
        echo "  Check logs: pm2 logs"
    fi
fi

echo ""
echo "=================================="
echo "✅ Restart complete"
echo "=================================="
echo ""
