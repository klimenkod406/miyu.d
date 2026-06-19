#!/bin/bash
# Runner: Infrastructure TDD test suite
# Runs all test-*.sh scripts in this directory
# Reports pass/fail summary at the end

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
START_TIME=$(date +%s)

echo "============================================"
echo "  Infrastructure TDD Test Suite"
echo "  $(date)"
echo "============================================"
echo ""

FAILED=0
TOTAL=0
PASSED=0
SKIPPED=0

for test in "$SCRIPT_DIR"/test-*.sh; do
  if [ ! -f "$test" ]; then
    echo "WARN: No test files found in $SCRIPT_DIR"
    exit 1
  fi

  TOTAL=$((TOTAL + 1))
  basename_test=$(basename "$test")
  echo ""
  echo "--- [$TOTAL] Running: $basename_test ---"

  # Ensure test is executable
  if [ ! -x "$test" ]; then
    chmod +x "$test"
  fi

  set +e
  output=$(bash "$test" 2>&1)
  rc=$?
  set -e

  if [ $rc -eq 0 ]; then
    echo "$output" | grep -E "^(PASS|SKIP|  (OK|PASS|WARN))" || true
    if echo "$output" | grep -q "^SKIP"; then
      SKIPPED=$((SKIPPED + 1))
    else
      PASSED=$((PASSED + 1))
    fi
    echo "  >> RESULT: PASSED"
  else
    echo "$output"
    echo "  >> RESULT: FAILED (exit code $rc)"
    FAILED=$((FAILED + 1))
  fi
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "============================================"
echo "  Summary"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Skipped: $SKIPPED"
echo "  Duration: ${DURATION}s"
echo "============================================"

if [ "$FAILED" -eq 0 ]; then
  echo "  ALL TESTS PASSED"
  exit 0
else
  echo "  SOME TESTS FAILED ($FAILED failure(s))"
  exit 1
fi
