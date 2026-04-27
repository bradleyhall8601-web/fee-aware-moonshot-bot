#!/bin/bash
# scripts/notify-brad-fixes.sh
# Send notification about fixes via Telegram

BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
OWNER_ID=${OWNER_TELEGRAM_ID:-}
MESSAGE=${1:-"MoonShotForge: System update applied successfully"}

if [ -z "$BOT_TOKEN" ] || [ -z "$OWNER_ID" ]; then
  echo "⚠️  TELEGRAM_BOT_TOKEN or OWNER_TELEGRAM_ID not set"
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${OWNER_ID}\",\"text\":\"🔧 ${MESSAGE}\",\"parse_mode\":\"Markdown\"}"

echo ""
echo "✅ Notification sent"
