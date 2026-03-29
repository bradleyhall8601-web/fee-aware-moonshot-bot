#!/bin/bash
# scripts/setup-vps.sh
# VPS initial setup script

set -e

echo "========================================="
echo "Fee-Aware Moonshot Bot - VPS Setup"
echo "========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

echo "📦 Installing system dependencies..."
apt-get update
apt-get upgrade -y
apt-get install -y \
    nodejs \
    npm \
    git \
    curl \
    wget \
    build-essential \
    python3 \
    python3-pip \
    sqlite3 \
    docker.io \
    docker-compose

# Add current user to docker group
usermod -aG docker $SUDO_USER

echo "🔐 Creating application user..."
useradd -m -s /bin/bash moonshot || true
usermod -aG docker moonshot

echo "📁 Setting up application directory..."
mkdir -p /opt/fee-aware-moonshot-bot
chown moonshot:moonshot /opt/fee-aware-moonshot-bot

echo "🚀 Installing PM2 globally..."
npm install -g pm2
pm2 install pm2-logrotate

echo "🔧 Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp
    ufw enable
fi

echo "✅ VPS setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Clone the repository: git clone <repo-url> /opt/fee-aware-moonshot-bot"
echo "2. Create environment file: cp .env.example .env"
echo "3. Configure your secrets in .env"
echo "4. Run: npm install && npm run build"
echo "5. Start the bot: npm run pm2:start"
echo ""
echo "Happy trading! 🚀"
