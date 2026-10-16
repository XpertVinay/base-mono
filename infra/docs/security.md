# Security Architecture & Hardening Controls

## 1. Security by Default Principles

The platform follows a zero-trust, least-privilege security baseline:

1. **No Open Administrative Access in Production**:
   - In `prod`, administrative SSH (`22`) rejects `0.0.0.0/0` at Terraform plan time via input validation.
   - Access must come through dedicated VPNs, bastion hosts, or AWS Systems Manager Session Manager.
2. **Short-Lived Workload Identity**:
   - Compute instances authenticate to cloud APIs via IAM Roles / Instance Profiles (AWS) or Service Accounts (GCP), avoiding hardcoded static API keys on disk.
3. **Defense-in-Depth Host Protection**:
   - Root password logins and password authentication are explicitly disabled via `/etc/ssh/sshd_config`.
   - Host-level firewall (**UFW**) blocks all unsolicited incoming ports by default.
   - **Fail2ban** actively monitors authentication logs to ban abusive connection attempts.
4. **State & Secret Protection**:
   - Terraform `.tfstate` files are excluded from version control via `.gitignore`.
   - In production, state files must use encrypted S3/GCS buckets with server-side encryption (KMS) and DynamoDB state locking.
   - Application secrets and environment variables are dynamically resolved via designated environment folders (`infra/environments/<env>/`).
   - Supports 3-tier precedence: CI/CD secrets, cloud provider secret managers (AWS Secrets Manager, AWS SSM, GCP Secret Manager, Azure Key Vault, Vault), and optional `.env` files. See [Dynamic Environmental Variables & Secret Management](environment-variables-and-secrets.md).
   - Sensitive credentials are never printed to console logs or committed to version control.
5. **Container Security**:
   - Applications run as non-root users (`UID: 10001`).
   - Root filesystem escalation is dropped (`allowPrivilegeEscalation: false`).
