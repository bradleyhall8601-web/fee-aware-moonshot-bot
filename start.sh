#!/bin/bash
# start.sh - Start MoonShotForge

set -e

echo "🚀 Starting MoonShotForge..."

# Create required directories
mkdir -p data logs

# Check for .env file
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Please edit .env with your configuration"
fi

# Start the bot
if [ "$NODE_ENV" = "production" ]; then
  echo "🏭 Production mode: starting compiled JS"
  node dist/index.js
else
  echo "🔧 Development mode: starting with tsx"
  npx tsx src/index.ts
fi
