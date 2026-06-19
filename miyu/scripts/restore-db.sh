#!/bin/bash
set -euo pipefail
if [ -z "${1:-}" ]; then echo "Usage: $0 <backup-file>"; echo "Available backups:"; ls -t database/backups/miyu.db.backup.* 2>/dev/null || echo "None"; exit 1; fi
BACKUP_FILE="$1"
TARGET="${2:-database/miyu.db}"
echo "Restoring $BACKUP_FILE to $TARGET"
echo "Verifying backup integrity..."
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok" || { echo "Backup integrity FAILED"; exit 1; }
cp "$TARGET" "$TARGET.before-restore.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
cp "$BACKUP_FILE" "$TARGET"
echo "Restore complete."
