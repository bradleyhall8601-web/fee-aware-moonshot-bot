#!/usr/bin/env bash
set -euo pipefail

# One-command local deployment helper for VPS/runtime hosts.
# Requirements: git, npm, PM2, environment variables already configured.

APP_NAME="fee-aware-moonshot-bot"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[deploy] Pulling latest code"
git pull --ff-only

echo "[deploy] Installing dependencies"
npm install

echo "[deploy] Building backend"
npm run build

if [[ -f "frontend/package.json" ]]; then
  echo "[deploy] Building frontend"
  (cd frontend && npm install && npm run build)
else
  echo "[deploy] Frontend package not found; skipping frontend build"
fi

if command -v pm2 >/dev/null 2>&1; then
  PM2_CMD="pm2"
else
  PM2_CMD="npx pm2"
fi

echo "[deploy] Restarting PM2 app"
if $PM2_CMD describe "$APP_NAME" >/dev/null 2>&1; then
  $PM2_CMD restart ecosystem.config.js --update-env
else
  $PM2_CMD start ecosystem.config.js --env production
fi

echo "[deploy] PM2 status"
$PM2_CMD status

echo "[deploy] Complete"
