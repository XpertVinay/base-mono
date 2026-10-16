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

---

## 4. Local Workstation Kubernetes (Kind / Minikube / Docker Desktop / K3s)

### When to choose:
- Zero cloud cost, local testing of Kubernetes manifests, ingress, ConfigMaps, and Secrets before deploying to staging/prod.
- Fast inner-loop developer feedback without cloud latency.

### Architecture & Overlay Features:
- Located under `kubernetes/overlays/local/`.
- **Namespace**: `local` for isolated workload testing.
- **Dynamic ConfigMap & Secrets**: Generated dynamically via `load-env.sh local k8s` from `environments/local/secrets.spec.yaml`.
- **Image Pull Policy**: `imagePullPolicy: IfNotPresent` to allow direct consumption of locally built Docker images.
- **Lightweight Workstation Resources**: CPU requests of `50m` and memory requests of `64Mi`.
- **NodePort Access**: Configured with `nodePort: 30080` (accessible at `http://localhost:30080`).

### Developer Commands:
```bash
# 1. Generate dynamic environment manifests and deploy to local Kubernetes
make local-k8s-deploy

# 2. Check running pods, services, and configs
make local-k8s-status

# 3. Delete local workloads
make local-k8s-delete

# Or using the standard environment parameter:
make deploy-k8s ENV=local
```
