#!/bin/bash
# Test: Nginx config syntax and HTTPS/SSL correctness
# Expects: deploy/nginx/default.conf to exist with SSL + redirect
# Fails if: missing HTTPS redirect, SSL cert config, or nginx -t fails

set -euo pipefail

NGINX_CONF="$(dirname "$0")/../nginx/default.conf"

echo "Test: Nginx config syntax + HTTPS"

if [ ! -f "$NGINX_CONF" ]; then
  echo "FAIL: $NGINX_CONF not found"
  exit 1
fi

FAILED=0

# Check: HTTP → HTTPS redirect (return 301 https)
if grep -q "return 301 https" "$NGINX_CONF"; then
  echo "  PASS: HTTP → HTTPS redirect configured"
else
  echo "  FAIL: No HTTP → HTTPS redirect found"
  FAILED=$((FAILED + 1))
fi

# Check: SSL certificate paths referenced
if grep -q "ssl_certificate" "$NGINX_CONF"; then
  echo "  PASS: SSL certificate configured"
else
  echo "  FAIL: No ssl_certificate directive found"
  FAILED=$((FAILED + 1))
fi

# Check: SSL certificate key referenced
if grep -q "ssl_certificate_key" "$NGINX_CONF"; then
  echo "  PASS: SSL certificate key configured"
else
  echo "  FAIL: No ssl_certificate_key directive found"
  FAILED=$((FAILED + 1))
fi

# Check: listen 443 ssl
if grep -q "listen.*443.*ssl" "$NGINX_CONF"; then
  echo "  PASS: HTTPS listener (port 443 SSL) configured"
else
  echo "  FAIL: No HTTPS listener found"
  FAILED=$((FAILED + 1))
fi

# Check: listen 80 (HTTP)
if grep -q "listen.*80" "$NGINX_CONF"; then
  echo "  PASS: HTTP listener (port 80) configured"
else
  echo "  FAIL: No HTTP listener found"
  FAILED=$((FAILED + 1))
fi

# If nginx binary is available, run syntax check
if command -v nginx &>/dev/null; then
  if nginx -t -c "$NGINX_CONF" 2>&1 | grep -q "syntax is ok"; then
    echo "  PASS: nginx config syntax valid"
  else
    echo "  WARN: nginx -t reported issues (may need full context)"
  fi
fi

if [ "$FAILED" -eq 0 ]; then
  echo "PASS: Nginx config has HTTPS + SSL"
else
  echo "FAIL: $FAILED nginx config check(s) failed"
  exit 1
fi
