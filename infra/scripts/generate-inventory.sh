#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: GENERATE ANSIBLE INVENTORY FROM TERRAFORM OUTPUTS
# Purpose:
#   Extracts normalized 'inventory_metadata' output from Terraform and generates
#   a structured, secure Ansible inventory file for the target environment.
# Security:
#   Never exports credentials, cloud tokens, or private keys to the inventory.
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
INV_DIR="ansible/inventories/${ENVIRONMENT}"
OUTPUT_FILE="${INV_DIR}/hosts.yaml"

echo "======================================================================"
echo " [Inventory Generator] Generating inventory for environment: ${ENVIRONMENT}"
echo "======================================================================"

if [ ! -d "${TF_DIR}" ]; then
  echo "Error: Directory ${TF_DIR} does not exist inside ${INFRA_ROOT}."
  exit 1
fi

mkdir -p "${INV_DIR}"

echo "Extracting Terraform outputs from ${TF_DIR}..."
pushd "${TF_DIR}" > /dev/null

if ! terraform output -json inventory_metadata > /tmp/tf_inv.json 2>/dev/null; then
  echo "Warning: Terraform has not provisioned infrastructure yet or state is empty."
  echo "Generating fallback placeholder inventory..."
  popd > /dev/null
  cat <<EOF > "${OUTPUT_FILE}"
all:
  vars:
    ansible_user: ubuntu
    environment: ${ENVIRONMENT}
    deployment_mode: docker
  children:
    app_servers:
      hosts: {}
    control_plane:
      hosts: {}
    workers:
      hosts: {}
EOF
  echo "Fallback inventory created at ${OUTPUT_FILE}."
  python3 "${SCRIPT_DIR}/load-env.py" "${ENVIRONMENT}" ansible
  exit 0
fi

popd > /dev/null

# Parse JSON via Python or jq and write YAML
python3 - <<EOF
import json, yaml, sys

with open("/tmp/tf_inv.json") as f:
    data = json.load(f)

hosts = data.get("hosts", [])
env = data.get("environment", "${ENVIRONMENT}")
mode = data.get("mode", "docker")
provider = data.get("provider", "aws")

inv_vars = {
    "ansible_user": "ubuntu",
    "target_env": env,
    "deployment_mode": mode,
    "infra_provider": provider
}

if provider == "local":
    inv_vars["ansible_connection"] = "docker"
    inv_vars["ansible_user"] = "root"

inv = {
    "all": {
        "vars": inv_vars,
        "children": {
            "app_servers": {"hosts": {}},
            "control_plane": {"hosts": {}},
            "workers": {"hosts": {}}
        }
    }
}

for host in hosts:
    hname = host.get("name")
    ip = host.get("ansible_ip")
    role = host.get("role", "worker")
    ansible_user = host.get("ansible_user")
    
    host_entry = {"ansible_host": ip, "node_role": role}
    if ansible_user:
        host_entry["ansible_user"] = ansible_user
    inv["all"]["children"]["app_servers"]["hosts"][hname] = host_entry
    
    if role in ["control-plane", "standalone"]:
        inv["all"]["children"]["control_plane"]["hosts"][hname] = host_entry
    else:
        inv["all"]["children"]["workers"]["hosts"][hname] = host_entry

with open("${OUTPUT_FILE}", "w") as out:
    yaml.dump(inv, out, default_flow_style=False)

print(f"Successfully generated inventory with {len(hosts)} host(s) at ${OUTPUT_FILE}")
EOF

rm -f /tmp/tf_inv.json

# Inject dynamic environment variables into Ansible group_vars
python3 "${SCRIPT_DIR}/load-env.py" "${ENVIRONMENT}" ansible
