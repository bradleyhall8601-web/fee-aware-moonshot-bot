#!/bin/bash

# Health Check Script
# Monitor bot health and restart if needed

echo "🔍 Performing system health check..."
echo ""

# Check if bot is running
echo "1️⃣  Checking if bot is running..."
if command -v pm2 &> /dev/null; then
    pm2 list
    RUNNING=$(pm2 list | grep -i "fee-aware" | wc -l)
else
    echo "  ℹ️  PM2 not found, checking process..."
    RUNNING=$(pgrep -f "node dist/index.js" | wc -l)
fi

if [ "$RUNNING" -gt 0 ]; then
    echo "  ✅ Bot process is running"
else
    echo "  ❌ Bot process is NOT running"
fi

echo ""

# Check API health
echo "2️⃣  Checking API health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

if [ "$HEALTH" = "200" ]; then
    echo "  ✅ API is healthy (HTTP $HEALTH)"
else
    echo "  ❌ API is unhealthy (HTTP $HEALTH)"
fi

echo ""

# Check database
echo "3️⃣  Checking database..."
if [ -f "data/trades.db" ]; then
    echo "  ✅ Database file exists"
    DB_SIZE=$(du -h data/trades.db | cut -f1)
    echo "  📊 Database size: $DB_SIZE"
else
    echo "  ⚠️  Database file not found"
fi

echo ""

# Check logs for errors
echo "4️⃣  Checking recent errors..."
if [ -f "logs/combined.log" ]; then
    ERROR_COUNT=$(tail -100 logs/combined.log | grep -i "error\|failed\|warn" | wc -l)
    echo "  📋 Recent errors/warnings: $ERROR_COUNT"
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "  Last 5 errors:"
        tail -100 logs/combined.log | grep -i "error\|failed" | tail -5 | sed 's/^/    /'
    fi
else
    echo "  ℹ️  No logs found yet"
fi

echo ""

# Check disk space
echo "5️⃣  Checking disk space..."
DISK=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK" -lt 80 ]; then
    echo "  ✅ Disk usage: ${DISK}% (OK)"
else
    echo "  ⚠️  Disk usage: ${DISK}% (High)"
fi

echo ""

# Check memory
echo "6️⃣  Checking memory usage..."
if command -v free &> /dev/null; then
    MEM=$(free | awk 'NR==2 {printf("%.0f", $3/$2 * 100.0)}')
    echo "  📊 Memory usage: ${MEM}%"
fi

echo ""
echo "=================================="
echo "✅ Health check complete"
echo "=================================="
echo ""

# Auto-restart if needed
if [ "$RUNNING" -eq 0 ] && [ "$HEALTH" != "200" ]; then
    echo "🔄 Attempting automatic restart..."
    if command -v pm2 &> /dev/null; then
        npm run pm2:restart
        sleep 3
        echo "✅ Bot restarted with PM2"
    fi
fi

echo ""
