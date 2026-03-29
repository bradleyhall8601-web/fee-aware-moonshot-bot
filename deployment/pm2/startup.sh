#!/bin/bash

# PM2 Startup Script
# Initializes PM2 and starts the application

echo "🚀 Starting with PM2..."
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed"
    echo "Install with: npm install -g pm2"
    exit 1
fi

# Build application
echo "📦 Building application..."
npm run build || exit 1

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 start deployment/pm2/ecosystem.config.js

# Enable startup script
echo "🔧 Enabling PM2 startup script..."
pm2 startup
pm2 save

# Show status
echo ""
echo "=================================="
echo "✅ Application started with PM2"
echo "=================================="
echo ""
echo "Commands:"
echo "  View logs:     pm2 logs"
echo "  View status:   pm2 list"
echo "  Monitor:       pm2 monit"
echo "  Restart:       pm2 restart fee-aware-moonshot-bot"
echo "  Stop:          pm2 stop fee-aware-moonshot-bot"
echo ""
