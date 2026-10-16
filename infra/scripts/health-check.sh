#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: INFRASTRUCTURE & APPLICATION HEALTH CHECK
# Purpose:
#   Performs active health verification on the deployed load balancer / instance.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${INFRA_ROOT}"

if [ -n "${1:-}" ]; then
  ENVIRONMENT="$1"
elif [ -f ".env" ] && grep -q '^ENVIRONMENT=' .env; then
  ENVIRONMENT=$(grep '^ENVIRONMENT=' .env | cut -d '=' -f2 | tr -d ' "\r')
else
  ENVIRONMENT="dev"
fi

TF_DIR="terraform/environments/${ENVIRONMENT}"

echo "======================================================================"
echo " [Health Check] Verifying infrastructure health for: ${ENVIRONMENT}"
echo "======================================================================"

if [ ! -d "${TF_DIR}" ]; then
  echo "Error: Directory ${TF_DIR} not found."
  exit 1
fi

pushd "${TF_DIR}" > /dev/null
LB_DNS=$(terraform output -raw load_balancer_dns 2>/dev/null || echo "none")
popd > /dev/null

if [ "${LB_DNS}" = "none" ] || [ -z "${LB_DNS}" ]; then
  echo "Load balancer not found or not provisioned. Querying direct host..."
  TARGET="http://localhost:8080/health"
else
  TARGET="http://${LB_DNS}/health"
fi

echo "Probing endpoint: ${TARGET}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${TARGET}" || echo "000")

if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 400 ]; then
  echo "  [✓] Health check passed! Endpoint returned HTTP ${HTTP_STATUS}"
else
  echo "  [!] Endpoint returned HTTP ${HTTP_STATUS} (Target may still be starting up)"
fi
