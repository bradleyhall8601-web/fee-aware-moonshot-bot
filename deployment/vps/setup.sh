#!/bin/bash

# VPS Initial Setup Script
# Run this once on a fresh VPS to install all dependencies

set -e

echo "=================================="
echo "Fee-Aware Moonshot Bot - VPS Setup"
echo "=================================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
else
    echo "❌ Unsupported OS. This script requires Linux or Mac."
    exit 1
fi

echo "🔧 Setting up for $OS"
echo ""

# Step 1: Update system
echo "📦 Step 1: Updating system packages..."
if [ "$OS" = "linux" ]; then
    sudo apt-get update
    sudo apt-get upgrade -y
fi

# Step 2: Install Node.js if not present
echo "📦 Step 2: Installing Node.js..."
if ! command -v node &> /dev/null; then
    echo "  Installing Node.js..."
    if [ "$OS" = "linux" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        brew install node@20
        brew link node@20
    fi
else
    echo "  ✓ Node.js already installed ($(node -v))"
fi

# Step 3: Install npm packages
echo "📦 Step 3: Installing npm packages..."
npm install

# Step 4: Install PM2 globally
echo "📦 Step 4: Installing PM2..."
sudo npm install -g pm2

# Step 5: Enable PM2 startup
echo "📦 Step 5: Configuring PM2 startup..."
pm2 startup
pm2 save

# Step 6: Build the project
echo "📦 Step 6: Building TypeScript..."
npm run build

# Step 7: Create necessary directories
echo "📦 Step 7: Creating directories..."
mkdir -p data logs config

# Step 8: Create .env file if not present
echo "📦 Step 8: Setting up environment..."
if [ ! -f ".env" ]; then
    echo "  Creating .env file..."
    cat > .env.example << 'EOF'
# Telegram Configuration
TELEGRAM_BOT_TOKEN=7123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi
TELEGRAM_ADMIN_ID=123456789

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# API Server
API_PORT=3000
API_HOST=0.0.0.0

# Database
DB_PATH=/data/trades.db

# Trading
LIVE_TRADING_ENABLED=false

# Logging
LOG_LEVEL=info
EOF
    echo "  ⚠️  Created .env.example - Please update .env with your credentials"
    cp .env.example .env
else
    echo "  ✓ .env already exists"
fi

# Step 9: Test the build
echo "📦 Step 9: Testing build..."
npm run build
npx tsc --noEmit

echo ""
echo "=================================="
echo "✅ VPS Setup Complete!"
echo "=================================="
echo ""
echo "📝 Next Steps:"
echo "1. Edit .env with your credentials:"
echo "   nano .env"
echo ""
echo "2. Start the bot:"
echo "   npm run pm2:start"
echo ""
echo "3. Monitor logs:"
echo "   pm2 logs"
echo ""
echo "4. View processes:"
echo "   pm2 list"
echo ""
echo "=================================="
echo ""
