#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: AUTOMATED PLATFORM VALIDATION & TESTING
# Purpose:
#   Validates Terraform formatting, configuration syntax, variable constraints
#   (1-5 application servers), and Ansible playbook syntax without creating
#   paid cloud infrastructure.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${INFRA_ROOT}"

echo "======================================================================"
echo " [Platform Validation] Running Automated Syntax and Safety Checks"
echo "======================================================================"

# 1. Terraform Formatting Check
echo "Step 1: Checking Terraform formatting..."
if command -v terraform > /dev/null 2>&1; then
  terraform fmt -check -recursive terraform/ || {
    echo "Terraform formatting check failed! Run 'make fmt' to fix."
    exit 1
  }
  echo "  [✓] Terraform files properly formatted."

  # 2. Terraform Provider Validation (AWS & GCP)
  echo "Step 2: Validating AWS Provider Adapter..."
  pushd terraform/providers/aws > /dev/null
  terraform init -backend=false > /dev/null
  terraform validate
  popd > /dev/null
  echo "  [✓] AWS provider adapter passed validation."

  echo "Step 3: Validating GCP Provider Adapter..."
  pushd terraform/providers/gcp > /dev/null
  terraform init -backend=false > /dev/null
  terraform validate
  popd > /dev/null
  echo "  [✓] GCP provider adapter passed validation."

  echo "Step 4: Validating Azure Provider Adapter..."
  pushd terraform/providers/azure > /dev/null
  terraform init -backend=false > /dev/null
  terraform validate
  popd > /dev/null
  echo "  [✓] Azure provider adapter passed validation."

  echo "Step 5: Validating DigitalOcean Provider Adapter..."
  pushd terraform/providers/digitalocean > /dev/null
  terraform init -backend=false > /dev/null
  terraform validate
  popd > /dev/null
  echo "  [✓] DigitalOcean provider adapter passed validation."

  echo "Step 6: Validating Generic VPS Provider Adapter..."
  pushd terraform/providers/vps > /dev/null
  terraform init -backend=false > /dev/null
  terraform validate
  popd > /dev/null
  echo "  [✓] Generic VPS provider adapter passed validation."

  # 3. Application Server Count Constraint Testing (1 to 5)
  echo "Step 7: Testing Application Server Count Constraints (1 to 5)..."
  ./tests/test_server_count_bounds.sh
else
  echo "  [i] 'terraform' CLI not detected on this machine. (Formatting & plan checks run in GitHub Actions CI)."
fi

# 4. Ansible Playbook Syntax Checks
echo "Step 8: Checking Ansible Playbook syntax..."
pushd ansible > /dev/null
if command -v ansible-playbook > /dev/null 2>&1; then
  ansible-playbook --syntax-check playbooks/bootstrap.yml
  ansible-playbook --syntax-check playbooks/docker-host.yml
  ansible-playbook --syntax-check playbooks/k8s-cluster.yml
  ansible-playbook --syntax-check playbooks/deploy-app.yml
  echo "  [✓] All Ansible playbooks passed syntax checks."
else
  echo "  [i] ansible-playbook not found locally. Skipping syntax check."
fi
popd > /dev/null

# 5. Dynamic Environment Variables and Secrets Tests
echo "Step 9: Testing Dynamic Environment & Secrets Management..."
python3 ./tests/test_dynamic_env.py
echo "  [✓] All Dynamic Environment & Secrets tests passed."

echo "======================================================================"
echo " [Platform Validation] All checks passed successfully!"
echo "======================================================================"
