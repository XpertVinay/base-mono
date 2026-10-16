# Provider Adapter Extension Guide

## 1. Overview

The platform uses a modular provider adapter pattern. To add a new cloud provider (e.g., Azure, DigitalOcean, Hetzner, or VMware vSphere), you create a new directory under `terraform/providers/<provider-name>/` that implements the standard infrastructure contract.

---

## 2. Mandatory Contract Checklist

Every provider adapter must implement:

### Required Inputs (`variables.tf`)
| Variable | Type | Validation / Constraints |
| :--- | :--- | :--- |
| `environment` | `string` | Must be `dev`, `staging`, or `prod` |
| `project_name` | `string` | Regex `^[a-z0-9-]+$` |
| `application_server_count` | `number` | **MUST enforce 1 <= count <= 5 and floor check** |
| `ssh_public_key` | `string` | Public key string |
| `admin_cidr_blocks` | `list(string)` | Restricted network blocks |
| `deployment_mode` | `string` | `docker`, `k8s-self-managed`, or `k8s-managed` |

### Required Outputs (`outputs.tf`)
| Output | Type | Description |
| :--- | :--- | :--- |
| `provider_name` | `string` | Name of the provider (e.g., "azure") |
| `application_server_private_ips` | `list(string)` | Internal IPs of application servers |
| `application_server_hostnames` | `list(string)` | Predictable hostnames |
| `cluster_topology` | `map(string)` | IP -> `control-plane` or `worker` |
| `load_balancer_dns` | `string` | Ingress entrypoint hostname or IP |
| `inventory_metadata` | `object` | Normalized schema consumed by `scripts/generate-inventory.sh` |

---

## 3. Supported Provider Architectures

The platform defines two distinct architectural profiles depending on the hosting model:

### Profile A: Cloud Provider Architecture (AWS, GCP, Azure, DigitalOcean)
- **Scale**: Strict 1 to 5 application instances (`application_server_count`).
- **Topology**: Dedicated Virtual Private Cloud / VNet with public and private subnets, cloud firewalls / NSGs, and cloud load balancers.
- **Modes**:
  - `docker`: Standalone container workloads across instances.
  - `k8s-self-managed`: Multi-node Kubernetes via containerd and kubeadm.
  - `k8s-managed`: Managed cloud Kubernetes (EKS on AWS, GKE on GCP, AKS on Azure, DOKS on DigitalOcean).

### Profile B: Generic VPS Architecture (Hostinger, Contabo, OVH, etc.)
- **Scale**: Strictly **single server instance** (`application_server_count = 1`).
- **Topology**: Standalone VPS assigned a static public IPv4 from the hosting provider.
- **Modes**:
  - `docker`: Lightweight standalone container runtime via Docker Compose.
  - `k8s-self-managed`: Single-node lightweight cluster (k3s / single-node kubeadm).
- **Integration**: Feeds directly into normalized contract outputs and Ansible playbooks without cloud provider lock-in.

---

## 4. Handling Unsupported Capabilities

If a cloud or VPS provider lacks a specific native capability (e.g., lack of managed Kubernetes on a budget VPS provider):
- **DO NOT** silently ignore the request or fail halfway through.
- Throw a clear Terraform precondition or validation error:
```hcl
check "managed_k8s_supported" {
  assert {
    condition     = var.deployment_mode != "k8s-managed"
    error_message = "Generic VPS does not support cloud-managed Kubernetes. Please use 'docker' or 'k8s-self-managed' mode."
  }
}
```
