# Dynamic Environmental Variables & Secret Management

## 1. Overview & Architecture

The infrastructure platform employs a **dynamic, multi-source environment and secret resolution engine**. It strictly separates non-sensitive infrastructure parameters from sensitive secrets, adhering to the principle of least privilege and zero hardcoded credentials.

Configurations are managed in **designated folders according to environments**:

```plaintext
infra/
├── environments/                  # Primary designated environment folders
│   ├── dev/
│   │   ├── secrets.spec.yaml      # Declarative secret & variable specification
│   │   ├── .env.example           # Non-sensitive template for developer onboarding
│   │   ├── .env                   # (Optional, gitignored) Local engineer overrides
│   │   └── terraform.tfvars.example
│   ├── staging/
│   │   ├── secrets.spec.yaml
│   │   ├── .env.example
│   │   ├── .env                   # (Optional, gitignored)
│   │   └── terraform.tfvars.example
│   ├── prod/
│   │   ├── secrets.spec.yaml
│   │   ├── .env.example
│   │   ├── .env                   # (Optional, gitignored, break-glass only)
│   │   └── terraform.tfvars.example
│   └── local/
│       ├── secrets.spec.yaml
│       ├── .env.example
│       ├── .env                   # (Optional, gitignored)
│       └── terraform.tfvars.example
└── config/environments/           # Symlinked alias pointing to infra/environments/
```

---

## 2. Multi-Source Resolution Precedence

When any automation target runs (`make plan`, `make provision`, `make deploy-docker`, `make deploy-k8s`), the loader resolves variables and secrets using the following strict priority order (highest to lowest):

```
+-------------------------------------------------------------------------+
| Level 1: CI/CD Secrets & Process Environment (Highest Priority)         |
| - Runner secrets (e.g. GitHub Actions, GitLab CI, Jenkins)              |
| - Shell environment exports (e.g. TF_VAR_*, DATABASE_URL)               |
+------------------------------------+------------------------------------+
                                     | (If unassigned)
                                     v
+-------------------------------------------------------------------------+
| Level 2: Cloud Provider Secret Managers                                 |
| - AWS Secrets Manager (JSON key extraction or raw strings)              |
| - AWS Systems Manager Parameter Store (SSM with KMS decryption)         |
| - GCP Secret Manager                                                    |
| - Azure Key Vault                                                       |
| - HashiCorp Vault                                                       |
+------------------------------------+------------------------------------+
                                     | (If unassigned)
                                     v
+-------------------------------------------------------------------------+
| Level 3: .env Files (Completely Optional)                               |
| - environments/<env>/.env (Designated folder local override)            |
| - terraform/environments/<env>/.env                                     |
| - .env.<env> or .env (Root fallback)                                    |
| * If absent, execution continues smoothly without errors.               |
+------------------------------------+------------------------------------+
                                     | (If unassigned)
                                     v
+-------------------------------------------------------------------------+
| Level 4: Environment Specification Defaults                             |
| - Default non-sensitive values defined in secrets.spec.yaml             |
+-------------------------------------------------------------------------+
```

---

## 3. Designated Folder Specification (`secrets.spec.yaml`)

Each designated environment folder contains a `secrets.spec.yaml` defining non-sensitive variables, CI/CD secret bindings, and cloud secret manager pointers:

```yaml
environment: dev

# 1. Non-Sensitive Defaults
variables:
  ENVIRONMENT: dev
  INFRA_PROVIDER: aws
  AWS_REGION: us-east-1
  APPLICATION_SERVER_COUNT: 1
  INSTANCE_TYPE: t3.small
  DEPLOYMENT_MODE: docker
  APP_PORT: 8080
  HOST_PORT: 80
  LOG_LEVEL: debug
  NODE_ENV: development
  PROJECT_NAME: platform
  ADMIN_CIDR_BLOCKS: '["0.0.0.0/0"]'

# 2. CI/CD Secret Mappings
ci_secrets:
  AWS_ACCESS_KEY_ID: AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY: AWS_SECRET_ACCESS_KEY
  DATABASE_URL: DEV_DATABASE_URL
  API_SECRET_KEY: DEV_API_SECRET_KEY
  SSH_PUBLIC_KEY: DEV_SSH_PUBLIC_KEY

# 3. Cloud Provider Secret Managers
secret_managers:
  - env_var: DATABASE_URL
    provider: aws_secrets_manager
    secret_id: "dev/platform/database"
    key: "url"
    optional: true

  - env_var: API_SECRET_KEY
    provider: aws_secrets_manager
    secret_id: "dev/platform/api"
    key: "api_key"
    optional: true

  - env_var: SSH_PUBLIC_KEY
    provider: aws_ssm
    secret_id: "/dev/platform/ssh_public_key"
    optional: true
```

---

## 4. Workload Tier Integrations

### Terraform
- Automatically maps infrastructure variables to `TF_VAR_<name>`.
- Generates an ephemeral `terraform.tfvars.json` in `terraform/environments/<env>/` (strictly gitignored).
- Terraform plan and apply require **zero interactive prompts** or manual flags.

### Docker Compose & Ansible
- Extracts resolved dynamic environment variables to `ansible/inventories/<env>/group_vars/all/env.yaml`.
- The `app_docker` role renders a hardened `.env` file (`mode: '0600'`) on the target application hosts, injected into `docker-compose.yml`.

### Kubernetes
- Generates environment-specific `app-config.yaml` (`ConfigMap`) and `app-secrets.yaml` (`Secret`) in `kubernetes/overlays/<env>/`.
- Pod specifications reference both non-sensitive configs and secrets via `envFrom`.

---

## 5. Developer & Operational Commands

```bash
# View resolved dynamic environment variables as JSON
make env-show ENV=dev

# Generate ephemeral terraform.tfvars.json for target environment
make env-tfvars ENV=staging

# Generate dynamic Kubernetes ConfigMap and Secret manifests
make env-k8s ENV=prod

# Run any arbitrary command inside the dynamic environment context
./scripts/load-env.sh dev run terraform plan

# Evaluate shell exports for local terminal session
eval $(./scripts/load-env.sh dev export)

# Run complete platform validation test suite
make test
```
