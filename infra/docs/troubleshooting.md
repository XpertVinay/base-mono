# Infrastructure Troubleshooting & Diagnostics Guide

## 1. Common Issues & Resolution Matrix

### Issue 1: Terraform Variable Validation Error on Server Count
- **Symptom**: `Error: Invalid value for variable: application_server_count must be an integer from 1 through 5.`
- **Cause**: Attempted to set `application_server_count` to 0, negative, fractional, or > 5.
- **Resolution**: Supply a valid integer between 1 and 5 in `terraform.tfvars` or via `-var="application_server_count=3"`.

### Issue 2: Ansible SSH Unreachable (`Permission Denied (publickey)`)
- **Symptom**: `fatal: [node]: UNREACHABLE! => {"msg": "Permission denied (publickey)"}`
- **Cause**: Private key path does not match the public key supplied in Terraform, or SSH key permissions are too open.
- **Resolution**:
  1. Verify private key permissions: `chmod 600 ~/.ssh/id_rsa`.
  2. Confirm matching key path in `ansible/ansible.cfg` or inventory.

### Issue 3: Self-Managed Kubernetes Kubelet Failing to Start
- **Symptom**: `kubelet.service: Main process exited, code=exited, status=1/FAILURE`
- **Cause**: Swap is enabled or containerd is not using systemd cgroup driver.
- **Resolution**:
  1. Run `swapoff -a` on the host.
  2. Verify `/etc/containerd/config.toml` has `SystemdCgroup = true`.
  3. Restart containerd: `systemctl restart containerd`.

### Issue 4: Application Container Exiting Unhealthy
- **Symptom**: Container restarts continuously or ALB target group marks node `unhealthy`.
- **Cause**: Application container does not expose `/health` endpoint or listens on the wrong port.
- **Resolution**:
  1. Inspect container logs: `docker logs <container_name>`.
  2. Test healthcheck locally on host: `curl -v http://localhost:8080/health`.
