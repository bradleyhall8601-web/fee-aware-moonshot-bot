#!/bin/bash

# VPS Deployment Script
# Deploy Fee-Aware Moonshot Bot to production VPS

set -e  # Exit on error

echo "=================================="
echo "Fee-Aware Moonshot Bot Deployment"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from project root."
    exit 1
fi

echo "📦 Step 1: Pulling latest code from main branch..."
git pull origin main

echo "📦 Step 2: Installing dependencies..."
npm install --production

echo "📦 Step 3: Building TypeScript..."
npm run build

# Check if build was successful
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo "❌ Build failed. dist folder is empty."
    exit 1
fi

echo "✅ Build successful"
echo ""

# Check if using PM2
if command -v pm2 &> /dev/null; then
    echo "🚀 Step 4: Restarting with PM2..."
    npm run pm2:restart
    echo "✅ Application restarted"
elif command -v docker &> /dev/null; then
    echo "🐳 Step 4: Deploying with Docker..."
    docker-compose -f docker-compose.yml up -d
    echo "✅ Docker deployment complete"
else
    echo "⚠️ Step 4: No PM2 or Docker found. Restart manually with: npm start"
fi

echo ""
echo "🔍 Step 5: Verifying deployment..."

# Wait for app to start
sleep 3

# Check health endpoint
HEALTH_CHECK=$(curl -s http://localhost:3000/health || echo "failed")

if [[ $HEALTH_CHECK == *"healthy"* ]]; then
    echo "✅ Health check passed"
else
    echo "⚠️ Health check failed. Check logs with: pm2 logs"
fi

echo ""
echo "=================================="
echo "✅ Deployment Complete!"
echo "=================================="
echo ""
echo "📊 Check status:"
echo "  • View logs: pm2 logs OR docker-compose logs -f"
echo "  • Check health: curl http://localhost:3000/health"
echo "  • Monitor: pm2 monit OR docker stats"
echo ""
echo "🤖 Telegram Bot: Running as @MoonShotForge_bot"
echo "📝 Add admins in .env: TELEGRAM_ADMIN_ID"
echo ""
