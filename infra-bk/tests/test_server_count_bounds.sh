#!/usr/bin/env bash
# ==============================================================================
# TEST SUITE: APPLICATION SERVER CAPACITY BOUNDS & VALIDATION
# Acceptance Criteria:
#   - Valid counts (1, 2, 3, 4, 5) MUST pass Terraform plan validation.
#   - Invalid counts (0, -1, 6, 2.5) MUST fail Terraform plan validation.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${INFRA_ROOT}"

TF_DIR="tests/fixtures/sizing_test"
PASS_COUNT=0
FAIL_COUNT=0

echo "======================================================================"
echo " [Test Suite] Application Server Sizing Boundary Tests"
echo "======================================================================"

if ! command -v terraform > /dev/null 2>&1; then
  echo "  [i] 'terraform' CLI not found on local path. Skipping plan execution."
  echo "      (This test runs automatically in GitHub Actions CI with Terraform 1.7+)."
  exit 0
fi

pushd "${TF_DIR}" > /dev/null
terraform init -backend=false > /dev/null 2>&1

test_count() {
  local count="$1"
  local expected="$2" # "pass" or "fail"
  
  set +e
  terraform plan -var="application_server_count=${count}" > /dev/null 2>&1
  local status=$?
  set -e

  if [ "${expected}" = "pass" ]; then
    if [ $status -eq 0 ]; then
      echo "  [PASS] Count ${count} accepted as valid."
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo "  [FAIL] Count ${count} was unexpectedly rejected!"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    if [ $status -ne 0 ]; then
      echo "  [PASS] Invalid count ${count} was properly rejected."
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo "  [FAIL] Invalid count ${count} was accepted when it should have failed!"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
}

echo "Testing Valid Bounds (1 to 5):"
test_count 1 "pass"
test_count 2 "pass"
test_count 3 "pass"
test_count 4 "pass"
test_count 5 "pass"

echo ""
echo "Testing Invalid Bounds (< 1, > 5, fractional):"
test_count 0 "fail"
test_count -1 "fail"
test_count 6 "fail"
test_count 2.5 "fail"

popd > /dev/null

echo "======================================================================"
echo " Summary: ${PASS_COUNT} Passed, ${FAIL_COUNT} Failed"
echo "======================================================================"

if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
fi
