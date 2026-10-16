# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: MANAGED KUBERNETES (DOKS)
# Purpose:
#   Provisions a DigitalOcean Kubernetes (DOKS) cluster when deployment_mode
#   is set to 'k8s-managed'.
# Sizing:
#   Strictly enforces 1 to 5 worker nodes matching application_server_count.
# ==============================================================================

# Data lookup for latest supported Kubernetes version in DigitalOcean
data "digitalocean_kubernetes_versions" "current" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0
}

resource "digitalocean_kubernetes_cluster" "doks" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name     = "${local.name_prefix}-doks"
  region   = var.do_region
  version  = data.digitalocean_kubernetes_versions.current[0].latest_version
  vpc_uuid = digitalocean_vpc.main.id

  node_pool {
    name       = "default-pool"
    size       = var.droplet_size
    node_count = var.application_server_count
    tags       = local.common_tags
  }

  tags = local.common_tags
}
