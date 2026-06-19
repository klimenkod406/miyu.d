#!/bin/bash
# Test: docker-compose.prod.yml syntax validation
# Expects: docker compose CLI to be installed
# Fails if: compose config is invalid

set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/../../docker-compose.prod.yml"

echo "Test: docker-compose.prod.yml syntax validation"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "FAIL: $COMPOSE_FILE not found"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "SKIP: docker CLI not available"
  exit 0
fi

if docker compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
  echo "PASS: Compose syntax valid"
else
  echo "FAIL: Compose syntax invalid"
  exit 1
fi
