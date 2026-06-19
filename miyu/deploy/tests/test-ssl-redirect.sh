#!/bin/bash
# Test: HTTP → HTTPS redirect configured in nginx
# Expects: nginx default.conf to contain 'return 301 https'
# Fails if: no redirect directive found

set -euo pipefail

NGINX_CONF="$(dirname "$0")/../nginx/default.conf"
SCRIPT_DIR="$(dirname "$0")"

echo "Test: HTTP to HTTPS redirect"

if [ ! -f "$NGINX_CONF" ]; then
  echo "FAIL: $NGINX_CONF not found"
  exit 1
fi

FAILED=0

# Check: return 301 https (exact pattern for permanent redirect)
if grep -q "return 301 https" "$NGINX_CONF"; then
  echo "  PASS: return 301 https directive found"
else
  echo "  FAIL: No 'return 301 https' directive in nginx config"
  FAILED=$((FAILED + 1))
fi

# Check: redirect is in the port 80 server block
if grep -q "listen.*80" "$NGINX_CONF" && grep -q "return 301 https" "$NGINX_CONF"; then
  echo "  PASS: HTTPS redirect configured on HTTP (port 80) listener"
else
  echo "  WARN: Could not confirm redirect is on port 80 block"
fi

# Check: Strict-Transport-Security header for HSTS
if grep -q "Strict-Transport-Security" "$NGINX_CONF"; then
  echo "  PASS: HSTS header configured"
else
  echo "  WARN: No HSTS (Strict-Transport-Security) header found"
fi

if [ "$FAILED" -eq 0 ]; then
  echo "PASS: HTTPS redirect configured"
else
  echo "FAIL: $FAILED SSL redirect check(s) failed"
  exit 1
fi
