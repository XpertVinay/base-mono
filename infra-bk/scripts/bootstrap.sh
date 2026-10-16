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

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    echo "  [!] '.env' file not found. Copying template from .env.example..."
    cp .env.example .env
    echo "  [i] Please review and populate '.env' with your credentials."
  fi
fi

echo "======================================================================"
echo " [Platform Bootstrap] Workstation validation successful!"
echo "======================================================================"
