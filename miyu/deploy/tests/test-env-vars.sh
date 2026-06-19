#!/bin/bash
# Test: Required environment variables are set
# Expects: .env.production file to exist with critical vars
# Fails if: required vars are missing

set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.production"
SCRIPT_DIR="$(dirname "$0")"

echo "Test: Required environment variables"

# Source the production env file if it exists
if [ -f "$ENV_FILE" ]; then
  # Read variable definitions (skip comments/blank lines); shellcheck safe source
  set +u
  while IFS='=' read -r key value; do
    # Skip comments and blank lines
    case "$key" in
      ''|\#*) continue ;;
    esac
    # Extract just the variable name (strip exports, etc.)
    varname="${key%% *}"
    # Only export if it looks like a valid env var name
    if echo "$varname" | grep -qE '^[A-Z_][A-Z0-9_]*$'; then
      export "$varname"="$value"
    fi
  done < "$ENV_FILE"
  set -u
  echo "  Sourced: $(basename "$ENV_FILE")"
else
  echo "  WARN: $(basename "$ENV_FILE") not found at $ENV_FILE"
fi

FAILED=0

# Critical infrastructure vars
check_var() {
  local varname="$1"
  local desc="$2"
  if [ -n "${!varname:-}" ]; then
    echo "  OK: $varname ($desc)"
  else
    echo "  FAIL: $varname not set ($desc)"
    FAILED=$((FAILED + 1))
  fi
}

check_var "JWT_SECRET" "JWT signing secret"
check_var "SESSION_SECRET" "Express session secret"
check_var "AI_SERVICE_ENABLED" "AI service toggle"
check_var "MIYU_AI_WHISPER_MODEL" "Whisper model name"
check_var "MIYU_AI_WHISPER_DEVICE" "Whisper device (cpu/cuda)"
check_var "MAX_UPLOAD_MB" "Max upload size in MB"

if [ -n "${FRONTEND_URL:-}" ]; then
  echo "  OK: FRONTEND_URL=$FRONTEND_URL"
else
  echo "  WARN: FRONTEND_URL not set (expected at runtime)"
fi

if [ "$FAILED" -eq 0 ]; then
  echo "PASS: Required env vars present"
else
  echo "FAIL: $FAILED required env var(s) missing"
  exit 1
fi
