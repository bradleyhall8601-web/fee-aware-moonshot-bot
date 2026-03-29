#!/bin/bash

# Backup Script
# Create secure backups of database and configuration

BACKUP_DIR="data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "🔄 Creating backups..."
echo ""

# Backup database
if [ -f "data/trades.db" ]; then
    BACKUP_FILE="$BACKUP_DIR/trades_${TIMESTAMP}.db"
    cp data/trades.db "$BACKUP_FILE"
    gzip "$BACKUP_FILE" 2>/dev/null || true
    echo "✅ Database backed up: $BACKUP_FILE.gz"
fi

# Backup configuration
if [ -f ".env" ]; then
    BACKUP_FILE="$BACKUP_DIR/env_${TIMESTAMP}.bak"
    cp .env "$BACKUP_FILE"
    echo "✅ Configuration backed up: $BACKUP_FILE"
fi

# Clean old backups (keep last 7 days)
echo ""
echo "🧹 Cleaning old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -type f -mtime +7 -delete
echo "✅ Old backups cleaned"

echo ""
echo "=================================="
echo "✅ Backup complete"
echo "=================================="
echo ""
