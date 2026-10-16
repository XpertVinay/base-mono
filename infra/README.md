# Provider-Agnostic Infrastructure as Code (IaC) Platform

[![Terraform](https://img.shields.io/badge/Terraform-%3E%3D1.5.0-844FBA.svg?logo=terraform)](#terraform-architecture)
[![Ansible](https://img.shields.io/badge/Ansible-%3E%3D2.15-EE0000.svg?logo=ansible)](#ansible-automation)
[![Docker](https://img.shields.io/badge/Docker-Engine%20%7C%20Compose-2496ED.svg?logo=docker)](#standalone-docker-mode)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Managed%20%7C%20Self--Managed-326CE5.svg?logo=kubernetes)](#kubernetes-modes)
[![Server Capacity](https://img.shields.io/badge/App%20Servers-1%20to%205%20Nodes-success.svg)](#application-server-scaling-1-to-5)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20Quality%20Gates-blue.svg)](#cicd-pipeline)

A production-grade, modular, and vendor-agnostic Infrastructure as Code platform designed to provision, harden, configure, and operate containerized applications across cloud providers and deployment topologies.

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Key Features & Tenets](#key-features--tenets)
- [Repository Structure](#repository-structure)
- [Application Server Capacity (1 to 5 Nodes)](#application-server-capacity-1-to-5-nodes)
- [Deployment Pathways](#deployment-pathways)
  - [1. Standalone Docker Mode](#1-standalone-docker-mode)
  - [2. Self-Managed Kubernetes](#2-self-managed-kubernetes)
  - [3. Managed Kubernetes](#3-managed-kubernetes)
- [Language-Agnostic Application Contract](#language-agnostic-application-contract)
- [Developer Workflow & Commands](#developer-workflow--commands)
- [Quickstart Guide](#quickstart-guide)
- [Automated Testing & Quality Gates](#automated-testing--quality-gates)
- [Documentation Index](#documentation-index)

---

## Architectural Overview

```
                                  +---------------------------------------+
                                  |         Internet Ingress / Users      |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        Application Load Balancer      |
                                  |         (Public Subnets / DMZ)        |
                                  +-------------------+-------------------+
                                                      | (Forward Port 8888)
                    +---------------------------------+---------------------------------+
                    | (Mode A: Standalone Docker)                                       | (Mode B: Kubernetes)
                    v                                                                   v
     +------------------------------+                                    +------------------------------+
     |   Application Servers (1-5)  |                                    |      Kubernetes Cluster      |
     |                              |                                    |                              |
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Node 1 (Ubuntu 22.04)  |  |                                    |  | Control Plane (Node 1) |  |
     |  | Docker + Node Exporter |  |                                    |  | kubeadm + Flannel CNI  |  |
     |  +------------------------+  |                                    |  +------------------------+  |
     |              |               |                                    |              | (Pod Overlay) |
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Node 2..5 (Private AZs)|  |                                    |  | Worker Nodes (2..5)    |  |
     |  | UFW + fail2ban Hardened|  |                                    |  | containerd CRI Runtime |  |
     |  +------------------------+  |                                    |  +------------------------+  |
     +--------------+---------------+                                    +--------------+---------------+
                    |                                                                   |
                    +---------------------------------+---------------------------------+
                                                      |
                                                      v
                                        +---------------------------+
                                        |   Persistent Storage      |
                                        |   Encrypted EBS / Cloud   |
                                        +---------------------------+
```

---

## Key Features & Tenets

1. **Provider-Agnostic Architecture**: Implements a normalized infrastructure contract across major cloud providers (**AWS, GCP, Azure, DigitalOcean**), single-node **Generic VPS** (Hostinger, Contabo, OVH), and **Local Docker** offline testing.
2. **Separation of Concerns**: Terraform manages infrastructure lifecycle; Ansible manages OS hardening and cluster bootstrap; Docker/Kubernetes manages application runtime.
3. **Application Server Capacity**: Strict enforcement of **1 to 5 application servers** for cloud providers, and **strictly 1 instance** for Generic VPS deployments.
4. **Dual Deployment Paths**:
   - **Standalone Docker**: No Kubernetes required. Deploy lightweight containers via Docker Compose.
   - **Kubernetes**: Run either self-managed (containerd + kubeadm + Flannel) or cloud-managed (EKS / GKE / AKS / DOKS).
5. **Language & Framework Independence**: Applications define an immutable container image, ports, resource limits, and health check endpoints through the [Application Deployment Contract](config/examples/app-contract.example.yaml).
6. **Security by Default**:
   - Least-privilege IAM roles with cloud identity management.
   - Public SSH (`0.0.0.0/0`) is **rejected** at plan time in production.
   - UFW firewall, fail2ban, and SSH password logins disabled.
   - Unprivileged container execution (`UID: 10001`).

---

## Repository Structure

```plaintext
infra/
├── Makefile                       # Developer automation targets (with LOAD_ENV)
├── .env.example                   # Environment configuration template
├── .gitignore                     # State, secret, and key protection rules
├── .editorconfig                  # Consistent cross-editor formatting
├── .pre-commit-config.yaml        # Local Git pre-commit hooks
├── environments/                  # Designated Environment Folders (Dynamic Config & Secrets)
│   ├── dev/                       # Dev specification (secrets.spec.yaml, .env.example, tfvars)
│   ├── staging/                   # Staging specification
│   ├── prod/                      # Prod specification
│   └── local/                     # Local Docker offline specification
├── config/                        # Language-agnostic deployment contracts & schema
│   ├── schema/                    # JSON Schema definition
│   ├── examples/                  # Sample contract specifications
│   └── environments/              # Symlink to environments/
├── terraform/                     # Infrastructure provisioning tier
│   ├── providers/                 # Provider adapters (AWS, GCP, Azure, DO, VPS, Local)
│   └── environments/              # Environment configurations (dev, staging, prod, local)
├── ansible/                       # Operating system configuration & bootstrap tier
│   ├── ansible.cfg                # Optimized SSH pipelining configuration
│   ├── requirements.yml           # Pinned community collections
│   ├── inventories/               # Auto-generated and static host inventories
│   ├── playbooks/                 # Orchestration playbooks (bootstrap, docker, k8s)
│   └── roles/                     # Modular roles (common, security, docker, k8s, monitoring)
├── containers/                    # Container templates & Compose manifests
│   ├── Dockerfile.example         # Language-neutral multi-stage unprivileged build
│   └── compose/                   # Standalone Docker Compose manifests
├── kubernetes/                    # Kubernetes manifests & Kustomize overlays
│   ├── base/                      # Base Deployment, Service, Ingress, HPA, NetworkPolicy
│   └── overlays/                  # Environment-specific overlays (dev, staging, prod)
├── scripts/                       # Executable lifecycle scripts
│   ├── load-env.sh / load-env.py  # Dynamic environment & secret manager loader engine
│   ├── bootstrap.sh               # Local workstation prerequisites validation
│   ├── generate-inventory.sh      # Terraform output to Ansible inventory generator
│   ├── validate.sh                # Syntax, formatting, bounds, and secrets test runner
│   └── health-check.sh            # Live endpoint probing script
├── tests/                         # Automated validation test suites
│   ├── test_server_count_bounds.sh# Unit test verifying 1-5 bounds enforcement
│   └── test_dynamic_env.py        # Automated test suite for dynamic envs & secret managers
├── docs/                          # Comprehensive architectural and operational guides
└── .github/workflows/             # Continuous Integration & Controlled Deployment
```

---

## Application Server Capacity (1 to 5 Nodes)

The platform strictly validates the application server count in Terraform:

| Node Count | Architecture Profile | Fault Tolerance | Typical Environment |
| :---: | :--- | :--- | :--- |
| **1** | Single standalone host | None (Downtime on host crash) | `dev` / Local POC |
| **2** | Dual host distribution | Limited (No quorum for Raft/etcd) | `staging` smoke test |
| **3** | Multi-AZ redundant cluster | High (1-node failure tolerated) | Baseline `prod` |
| **4 - 5** | Distributed high-concurrency | Very High (Multi-node redundancy) | Scaled `prod` |

Validation rules fail closed for any count `< 1`, `> 5`, or non-integer values:
```bash
./tests/test_server_count_bounds.sh
```

---

## Deployment Pathways

### 1. Standalone Docker Mode
Ideal for low-complexity or cost-sensitive workloads. Does not require Kubernetes components.
```bash
make deploy-docker ENV=dev
```

### 2. Self-Managed Kubernetes
Bootstraps a self-contained cluster using `containerd`, `kubeadm`, and `Flannel` CNI. Node 1 is assigned as the control plane; nodes 2–5 join as workers:
```bash
# Set DEPLOYMENT_MODE="k8s-self-managed"
make configure ENV=staging
make deploy-k8s ENV=staging
```

### 3. Managed Kubernetes
Provisions cloud-native managed clusters (AWS EKS or GCP GKE) with separate auto-scaling node pools:
```bash
# Set DEPLOYMENT_MODE="k8s-managed"
make provision ENV=prod
make deploy-k8s ENV=prod
```

---

## Developer Workflow & Commands

| Command | Purpose |
| :--- | :--- |
| `make init [ENV=dev]` | Initialize workstation tools and Terraform providers |
| `make fmt` | Automatically format all Terraform and Shell scripts |
| `make validate` | Run syntax validation, server count bounds, and secrets tests |
| `make lint` | Run `tflint` and `ansible-lint` static analysis |
| `make plan [ENV=dev]` | Review planned infrastructure modifications with dynamic env vars |
| `make provision [ENV=dev]` | Apply infrastructure changes with dynamic env vars |
| `make inventory [ENV=dev]` | Generate Ansible inventory and dynamic group_vars |
| `make configure [ENV=dev]` | Run Ansible playbooks for OS hardening & runtimes |
| `make deploy-docker [ENV=dev]`| Deploy application via Docker Compose with dynamic env |
| `make deploy-k8s [ENV=dev]` | Deploy application via Kubernetes Kustomize overlay |
| `make env-show [ENV=dev]` | Display resolved dynamic environment variables |
| `make env-tfvars [ENV=dev]` | Generate ephemeral `terraform.tfvars.json` |
| `make env-k8s [ENV=dev]` | Generate dynamic Kubernetes ConfigMap & Secret manifests |
| `make test` | Run complete automated validation test suite |
| `make health-check [ENV=dev]`| Probe load balancer and application `/health` endpoint |
| `make destroy [ENV=dev]` | Tear down infrastructure (requires confirmation for prod) |

---

## Quickstart Guide

### 1. Validate Workstation
```bash
./scripts/bootstrap.sh dev
```

### 2. Configure Environment (Optional Local Overrides)
```bash
# Each environment has its designated folder under environments/<env>/
# Note: .env is OPTIONAL. CI/CD secrets & Cloud Secret Managers are automatically resolved!
cp environments/dev/.env.example environments/dev/.env
```

### 3. Provision & Deploy (Development Docker Mode)
```bash
# Provision 1 application server on AWS with dynamic env vars
make provision ENV=dev

# Harden host and install Docker Engine
make configure ENV=dev

# Deploy application container
make deploy-docker ENV=dev

# Verify health
make health-check ENV=dev
```

---

## Documentation Index

- [Dynamic Environmental Variables & Secrets](docs/environment-variables-and-secrets.md)
- [Architecture & Design Principles](docs/architecture.md)
- [Provider Adapter Extension Guide](docs/provider-adapters.md)
- [Workstation & Cloud Prerequisites](docs/prerequisites.md)
- [Security & Hardening Controls](docs/security.md)
- [Server Sizing & Capacity Bounds](docs/server-sizing.md)
- [Kubernetes: Managed vs Self-Managed](docs/kubernetes.md)
- [Platform Operations & Day-2 Runbook](docs/operations.md)
- [Backup, Disaster Recovery & State Migration](docs/backup-recovery.md)
- [Troubleshooting & Diagnostics Guide](docs/troubleshooting.md)
