# Kubernetes Deployment Strategies: Managed vs Self-Managed

## 1. Architectural Paths

The platform supports two explicit Kubernetes operating models:

```
[ deployment_mode: "k8s-managed" ]      [ deployment_mode: "k8s-self-managed" ]
                 |                                       |
                 v                                       v
    Cloud Managed Control Plane              Self-Managed EC2 / GCE Hosts
        (AWS EKS / GCP GKE)                  (kubeadm + containerd + Flannel)
                 |                                       |
    Managed Auto-Scaling Nodes              Ansible Orchestrated Nodes
     (k8s_managed_node_count)               (application_server_count: 1 to 5)
```

---

## 2. Managed Kubernetes (AWS EKS / GCP GKE)

### When to choose:
- Production mission-critical environments.
- Zero administrative overhead for control-plane patching, etcd backups, and master node maintenance.
- Native cloud IAM integration (IRSA / Workload Identity).

### How it operates:
- Controlled via `terraform/providers/aws/k8s_managed.tf` and `gcp/k8s_managed.tf`.
- Nodes are managed via auto-scaling node groups.
- Applications deployed via standard Kustomize manifests:
  ```bash
  make deploy-k8s ENV=prod
  ```

---

## 3. Self-Managed Kubernetes (Kubeadm + Ansible)

### When to choose:
- Air-gapped, on-premises, or cost-constrained environments where cloud control plane fees are undesirable.
- Bare-metal or standard VM hosting (Hetzner, DigitalOcean, local VMs).

### Bootstrap Workflow:
1. **Terraform provisions compute instances** (1 to 5 nodes).
2. **`scripts/generate-inventory.sh` assigns cluster roles**:
   - Node 1 $\rightarrow$ `control-plane`
   - Nodes 2-5 $\rightarrow$ `worker`
3. **Ansible runs `k8s-cluster.yml`**:
   - Installs containerd with `SystemdCgroup = true`.
   - Runs `kubeadm init` on Node 1.
   - Deploys Flannel CNI (`10.244.0.0/16`).
   - Retrieves join token dynamically into runtime facts and joins worker nodes.

> [!CAUTION]
> **Single Control Plane Limitations**: In self-managed mode within the 1-5 server limit, running a single control-plane node does not provide high availability. If the primary node crashes, the Kubernetes API becomes unavailable until the node is restored. For production self-managed clusters, configure an odd number of control-plane nodes (3 or 5) with an external HAProxy load balancer in front of the API endpoint.
