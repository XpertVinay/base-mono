# Application Server Sizing & Topology Guide

## 1. Supported Application Server Capacity (1 to 5 Nodes)

The platform enforces a strict application server constraint: **a minimum of 1 and a maximum of 5 compute hosts**.

Validation is strictly evaluated during Terraform plan:
```hcl
variable "application_server_count" {
  type    = number
  default = 1

  validation {
    condition = (
      var.application_server_count >= 1 &&
      var.application_server_count <= 5 &&
      var.application_server_count == floor(var.application_server_count)
    )
    error_message = "application_server_count must be an integer from 1 through 5."
  }
}
```

---

## 2. Deployment Profiles

### Profile 1: Single Node (`count = 1`)
- **Target Use Cases**: Development, POC, lightweight non-critical services.
- **Runtime Mode**: Standalone Docker Compose or Single-Node test cluster.
- **Caveat**: **Zero fault tolerance**. Host failure or kernel panic will cause complete service downtime. Not suitable for self-managed HA Kubernetes.

### Profile 2: Dual Node (`count = 2`)
- **Target Use Cases**: Staging, smoke testing multi-host synchronization.
- **Topology**:
  - Node 1: Primary worker / Control-plane.
  - Node 2: Secondary worker.
- **Caveat**: Two nodes do not provide an odd quorum for etcd/Raft. A split-brain network partition cannot be automatically reconciled without a third arbiter.

### Profile 3: Triple Node (`count = 3`)
- **Target Use Cases**: Baseline production deployment.
- **Topology**: Distributed across 3 separate Availability Zones (AZs).
- **Redundancy**: In Docker mode, traffic is balanced 33% per host behind the Application Load Balancer. In Self-Managed K8s, Node 1 acts as control-plane and Nodes 2 & 3 act as workers.

### Profile 4 & 5: Quad / Quint Node (`count = 4` or `5`)
- **Target Use Cases**: High-concurrency production workloads, heavy batch workers, or multi-tenant microservice fleets.
- **Capacity**: Multi-AZ load-balanced capacity with fine-grained CPU/memory reservations.

---

## 3. Disambiguation: Server Count vs. Cluster & App Dimensions

The platform provides **distinct, decoupled controls** for every architectural dimension:

| Configuration Parameter | Responsible Scope | Does NOT Dictate |
| :--- | :--- | :--- |
| `application_server_count` | Standalone EC2 / Compute Engine hosts (1 to 5) | Application container replica count |
| `k8s_managed_node_count` | Managed EKS / GKE auto-scaling worker nodes | Standalone application servers |
| `scaling.replicas` | Container / Pod instances deployed inside the runtime | Physical VM server count |
| Database High Availability | Provisioned as managed cloud datastore (RDS / Cloud SQL) | VM application server count |

> [!WARNING]
> Adding application servers does **NOT** automatically make an un-replicated database or a single-node control-plane highly available. State synchronization, database clustering, and storage replication require dedicated datastore architecture.
