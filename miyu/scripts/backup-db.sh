#!/bin/bash
set -euo pipefail
DB_PATH="${1:-database/miyu.db}"
BACKUP_DIR="${2:-database/backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/miyu.db.backup.$TIMESTAMP"
echo "Backing up $DB_PATH to $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"
echo "Verifying integrity..."
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok" && echo "Integrity: OK" || { echo "Integrity: FAILED"; rm "$BACKUP_FILE"; exit 1; }
echo "Rotating old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/miyu.db.backup.* 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
echo "Backup complete: $BACKUP_FILE"
