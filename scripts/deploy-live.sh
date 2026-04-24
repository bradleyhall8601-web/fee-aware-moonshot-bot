#!/usr/bin/env bash
set -euo pipefail

APP_NAME="fee-aware-moonshot-bot"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[INFO] pm2 not found globally; using npx pm2"
  PM2_CMD="npx pm2"
else
  PM2_CMD="pm2"
fi

echo "[1/4] Running live readiness checks"
npm run check:live

echo "[2/4] Ensuring logs directory"
mkdir -p logs

echo "[3/4] Deploying with PM2"
if $PM2_CMD describe "$APP_NAME" >/dev/null 2>&1; then
  $PM2_CMD restart ecosystem.config.js --update-env
else
  $PM2_CMD start ecosystem.config.js --env production
fi

echo "[4/4] PM2 status"
$PM2_CMD status

echo "[SUCCESS] Deployment complete. Use '$PM2_CMD logs $APP_NAME' to follow runtime logs."
