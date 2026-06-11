#!/bin/sh
set -e

mkdir -p \
  /app/database \
  /app/uploads/tracks \
  /app/uploads/albums \
  /app/uploads/avatars \
  /app/uploads/videos \
  /app/tmp/admin-imports

if [ -d /opt/seed-uploads ]; then
  cp -r -n /opt/seed-uploads/* /app/uploads/ 2>/dev/null || true
fi

exec "$@"
