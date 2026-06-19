#!/bin/bash
# Test: All 3 Dockerfiles present (frontend, backend, ai-service)
# Expects: Each service directory has a Dockerfile
# Fails if: any Dockerfile is missing

set -euo pipefail

PROJECT_ROOT="$(dirname "$0")/../.."

echo "Test: Dockerfiles present"

FAILED=0

for f in frontend/Dockerfile backend/Dockerfile ai-service/Dockerfile; do
  fullpath="$PROJECT_ROOT/$f"
  if [ -f "$fullpath" ]; then
    echo "  OK: $f"
  else
    echo "  FAIL: $f missing (expected at $fullpath)"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -eq 0 ]; then
  echo "PASS: All 3 Dockerfiles present"
else
  echo "FAIL: $FAILED Dockerfile(s) missing"
  exit 1
fi
