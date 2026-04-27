#!/bin/bash
# run-production.sh - Build and run in production mode

set -e

echo "🏭 MoonShotForge Production Build & Run"
echo ""

# Create directories
mkdir -p data logs

# Build
echo "📦 Building TypeScript..."
npm run build

echo ""
echo "✅ Build complete. Starting server..."
echo ""

NODE_ENV=production node dist/index.js
