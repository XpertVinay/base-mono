# Workstation & Cloud Prerequisites

## 1. Required Local Toolchains

Ensure the following tools are installed on your workstation prior to running `make init`:

| Tool | Minimum Version | Installation Reference |
| :--- | :--- | :--- |
| **Terraform** | `>= 1.5.0` | `brew install hashicorp/tap/terraform` |
| **Ansible** | `>= 2.15.0` | `pip install ansible ansible-lint` |
| **Docker** | `>= 24.0.0` | Docker Desktop / Docker Engine |
| **Kubectl** | `>= 1.28.0` | `brew install kubernetes-cli` |
| **Python** | `>= 3.10` | Standard Python 3 with `pyyaml` |
| **jq** | `>= 1.6` | `brew install jq` |

Verify all tools at once:
```bash
./scripts/bootstrap.sh
```

---

## 2. Cloud Credentials Setup

### AWS Deployment
Export your AWS CLI credentials or configure AWS SSO:
```bash
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
```

### GCP Deployment
Set your Google Application Credentials path:
```bash
export GCP_PROJECT_ID="my-gcp-project"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

---

## 3. SSH Key Generation

Generate a dedicated keypair for infrastructure administration:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/infra-platform-key -C "admin@infra-platform"
```
Populate `SSH_PUBLIC_KEY_PATH` and `SSH_PRIVATE_KEY_PATH` in `.env`.
