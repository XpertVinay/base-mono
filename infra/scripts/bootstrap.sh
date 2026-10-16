#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: BOOTSTRAP ENVIRONMENT & TOOL VALIDATION
# Purpose:
#   Validates local engineer workstation prerequisites (terraform, ansible,
#   docker, kubectl, jq) and ensures necessary environment files exist.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${INFRA_ROOT}"

echo "======================================================================"
echo " [Platform Bootstrap] Validating Local Engineering Prerequisites"
echo "======================================================================"

check_cmd() {
  local cmd="$1"
  local min_ver="${2:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "  [✓] Found: $cmd ($($cmd --version 2>&1 | head -n 1))"
  else
    echo "  [✗] Missing required tool: $cmd"
    return 1
  fi
}

echo "Checking CLI toolchains:"
check_cmd terraform
check_cmd ansible
check_cmd docker
check_cmd jq
check_cmd python3

TARGET_ENV="${1:-dev}"
ENV_DIR="environments/${TARGET_ENV}"

echo "Validating designated environment configuration for '${TARGET_ENV}':"
if [ -d "${ENV_DIR}" ]; then
  echo "  [✓] Found designated environment folder: ${ENV_DIR}"
  if [ -f "${ENV_DIR}/secrets.spec.yaml" ]; then
    echo "  [✓] Found secrets specification: ${ENV_DIR}/secrets.spec.yaml"
  fi
  if [ -f "${ENV_DIR}/.env" ]; then
    echo "  [i] Found local .env override at ${ENV_DIR}/.env"
  else
    echo "  [i] No local .env in ${ENV_DIR} (Optional: CI/CD secrets and cloud secret managers are active)."
  fi
fi

# Verify dynamic environment loader
python3 "${SCRIPT_DIR}/load-env.py" "${TARGET_ENV}" json > /dev/null && echo "  [✓] Dynamic environment loader initialized successfully."

echo "======================================================================"
echo " [Platform Bootstrap] Workstation validation successful!"
echo "======================================================================"
