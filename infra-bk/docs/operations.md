# Platform Operations & Day-2 Runbook

## 1. Daily Operational Commands

All platform interactions run through standard Makefile targets:

```bash
# 1. Inspect infrastructure state and diff against code
make plan ENV=dev

# 2. Apply infrastructure provisioning updates
make provision ENV=dev

# 3. Regenerate Ansible inventory from current Terraform state
make inventory ENV=dev

# 4. Re-run configuration management and security hardening
make configure ENV=dev

# 5. Deploy container workload updates
make deploy-docker ENV=dev    # For standalone Docker
make deploy-k8s ENV=dev       # For Kubernetes clusters

# 6. Verify health
make health-check ENV=dev
```

---

## 2. Rolling Application Updates & Zero-Downtime

### Standalone Docker Mode:
Application containers run behind the Application Load Balancer. When updating:
```bash
# Update APP_IMAGE in .env or deploy-app.yml
make deploy-docker ENV=prod
```
Docker Compose performs in-place container recreation, respecting health checks before marking the host healthy in the load balancer target group.

### Kubernetes Mode:
Deployments execute rolling updates according to the configured rollout strategy:
```bash
kubectl rollout status deployment/application-service -n prod
```
Rollback if necessary:
```bash
kubectl rollout undo deployment/application-service -n prod
```
