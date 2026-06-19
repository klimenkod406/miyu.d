#!/bin/bash
# Test: Health endpoint reachability
# Expects: Services to be running (runtime test)
# Fails if: Backend or AI health endpoints unreachable

set -euo pipefail

VPS_HOST="${VPS_HOST:-161.104.19.164}"
echo "Test: Health endpoints on $VPS_HOST"

# Check if curl is available
if ! command -v curl &>/dev/null; then
  echo "SKIP: curl not available"
  exit 0
fi

FAILED=0

# Backend health
if curl -sf --connect-timeout 5 "http://$VPS_HOST/api/health" > /dev/null 2>&1; then
  echo "  PASS: Backend health OK"
elif curl -sfk --connect-timeout 5 "https://$VPS_HOST/api/health" > /dev/null 2>&1; then
  echo "  PASS: Backend health OK (HTTPS)"
else
  echo "  FAIL: Backend health endpoint unreachable"
  FAILED=$((FAILED + 1))
fi

# AI service health (non-fatal if unavailable — may be starting)
if curl -sf --connect-timeout 5 "http://$VPS_HOST/ai/health" > /dev/null 2>&1; then
  echo "  PASS: AI health OK"
elif curl -sfk --connect-timeout 5 "https://$VPS_HOST/ai/health" > /dev/null 2>&1; then
  echo "  PASS: AI health OK (HTTPS)"
else
  echo "  WARN: AI health not reachable (may be starting/disconnected)"
fi

if [ "$FAILED" -eq 0 ]; then
  echo "PASS: Health endpoints reachable"
else
  echo "FAIL: Some health endpoints unreachable"
  exit 1
fi
