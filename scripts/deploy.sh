#!/bin/bash
# scripts/deploy.sh
# Deployment script for remote VPS

set -e

VPS_HOST=${1:-}
VPS_USER=${2:-moonshot}
VPS_PATH=${3:-/opt/fee-aware-moonshot-bot}

if [ -z "$VPS_HOST" ]; then
    echo "Usage: $0 <vps-host> [vps-user] [app-path]"
    echo "Example: $0 123.45.67.89 moonshot /opt/fee-aware-moonshot-bot"
    exit 1
fi

echo "🚀 Deploying to $VPS_USER@$VPS_HOST:$VPS_PATH"
echo ""

# Build locally
echo "📦 Building project locally..."
npm run build

# Create deployment archive
echo "📦 Creating deployment archive..."
tar --exclude=node_modules --exclude=dist --exclude=.git --exclude=logs --exclude=data \
    -czf /tmp/bot-deploy.tar.gz .

# Upload and extract
echo "📤 Uploading to VPS..."
scp /tmp/bot-deploy.tar.gz $VPS_USER@$VPS_HOST:/tmp/bot-deploy.tar.gz

# Execute remote deployment
echo "🔧 Deploying on VPS..."
ssh $VPS_USER@$VPS_HOST << 'REMOTE_SCRIPT'
    set -e
    APP_PATH=${VPS_PATH:-/opt/fee-aware-moonshot-bot}
    
    echo "📂 Extracting files..."
    cd $APP_PATH
    tar --strip-components=1 -xzf /tmp/bot-deploy.tar.gz
    
    echo "📚 Installing dependencies..."
    npm ci --production
    
    echo "🔨 Building..."
    npm run build
    
    echo "❌ Stopping old instance..."
    pm2 stop fee-aware-moonshot-bot || true
    
    echo "✅ Starting new instance..."
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    pm2 save
    
    echo "✨ Deployment completed!"
    npm run health
REMOTE_SCRIPT

# Cleanup
rm /tmp/bot-deploy.tar.gz

echo ""
echo "✅ Deployment completed successfully!"
echo "Check logs: ssh $VPS_USER@$VPS_HOST 'pm2 logs'"
