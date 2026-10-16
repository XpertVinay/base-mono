# Platform Architecture & Design Principles

## 1. Executive Summary

This Infrastructure as Code (IaC) platform provides a **vendor-agnostic, decoupled, and dual-mode deployment system** supporting:
1. **Standalone Docker & Docker Compose** for lightweight single-node or distributed container execution.
2. **Kubernetes (Self-Managed via kubeadm or Managed via EKS/GKE)** for declarative cluster orchestration.

By strictly separating infrastructure provisioning (Terraform) from operating-system configuration (Ansible) and application lifecycle management (Containers/K8s), the platform avoids vendor lock-in and decouples application code from operational infrastructure.

---

## 2. Core Architectural Separation of Concerns

```
+-----------------------------------------------------------------------------------+
| 1. INFRASTRUCTURE PROVISIONING TIER (Terraform)                                   |
|    - Provisions VPCs, subnets, route tables, firewalls, and 1-5 compute instances |
|    - Manages block storage attachments, IAM roles, and Load Balancers             |
|    - Standardized outputs: IPs, hostnames, topology, inventory metadata           |
+------------------------------------------+----------------------------------------+
                                           |
                                           v (Outputs via scripts/generate-inventory.sh)
+-----------------------------------------------------------------------------------+
| 2. OS CONFIGURATION & HARDENING TIER (Ansible)                                    |
|    - OS baseline: NTP, swap disabling, kernel sysctl tuning                       |
|    - Security: UFW firewall, fail2ban, SSH key-only access, deployer user         |
|    - Container runtime installation: Docker Engine, containerd CRI                |
|    - Cluster Bootstrap (if self-managed K8s): kubeadm init, Flannel CNI, join     |
+------------------------------------------+----------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v (Mode A: Docker)                            v (Mode B: Kubernetes)
+---------------------------------------+     +---------------------------------------+
| 3. STANDALONE CONTAINER RUNTIME       |     | 3. KUBERNETES WORKLOAD ORCHESTRATION  |
|    - Docker Compose execution         |     |    - Kustomize Base & Overlays        |
|    - Non-root user (10001:10001)      |     |    - Horizontal Pod Autoscaling (HPA) |
|    - Resource limits & log rotation   |     |    - NetworkPolicies & Ingress        |
|    - Local healthcheck probes         |     |    - PodSecurityStandards enforced    |
+---------------------------------------+     +---------------------------------------+
```

---

## 3. The Provider-Agnostic Interface Contract

Terraform providers (AWS, GCP, Azure, DigitalOcean, Hetzner) do not share universal resource types. Portability is achieved through **adapter standardization**:

### Standard Inputs
- `environment` (`dev`, `staging`, `prod`)
- `application_server_count` (Integer: 1 to 5)
- `instance_type` / `machine_type`
- `ssh_public_key` & `admin_cidr_blocks`
- `deployment_mode` (`docker`, `k8s-self-managed`, `k8s-managed`)
- `enable_load_balancer` & `app_port`

### Standard Outputs
- `application_server_private_ips`
- `application_server_hostnames`
- `cluster_topology` (maps each node to `control-plane` or `worker`)
- `load_balancer_dns`
- `inventory_metadata` (machine-readable normalized payload consumed by Ansible)
