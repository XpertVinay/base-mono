#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: PLATFORM DYNAMIC ENVIRONMENT LOADER (SHELL WRAPPER)
# Purpose:
#   Resolves and injects dynamic environmental variables and secrets according
#   to designated environment folders (local, dev, staging, prod).
# Precedence:
#   1. CI/CD Secrets & Process Environment (Highest priority)
#   2. Cloud Provider Secret Managers (AWS Secrets Manager, SSM, GCP, Azure, Vault)
#   3. .env files (Completely optional, in designated folder or root)
#   4. Environment specification defaults (secrets.spec.yaml)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

USAGE="Usage: $0 <environment> [run <cmd...> | export | tfvars | k8s | ansible | json | dotenv]"

if [ $# -lt 1 ]; then
  echo "${USAGE}" >&2
  exit 1
fi

ENVIRONMENT="$1"
shift || true
ACTION="${1:-run}"

if [ "${ACTION}" = "run" ]; then
  shift || true
  exec python3 "${SCRIPT_DIR}/load-env.py" "${ENVIRONMENT}" run "$@"
else
  shift || true
  exec python3 "${SCRIPT_DIR}/load-env.py" "${ENVIRONMENT}" "${ACTION}" "$@"
fi
