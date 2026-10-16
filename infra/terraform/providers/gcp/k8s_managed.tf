# ==============================================================================
# GCP PROVIDER ADAPTER: MANAGED KUBERNETES (GOOGLE KUBERNETES ENGINE - GKE)
# Purpose:
#   Provisions a managed GKE cluster and node pool when 'deployment_mode' is 'k8s-managed'.
# ==============================================================================

resource "google_container_cluster" "primary" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name     = "${local.name_prefix}-gke"
  location = var.gcp_region
  project  = var.gcp_project_id

  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.subnet.id

  # We remove the default node pool to manage nodes through a separate resource
  remove_default_node_pool = true
  initial_node_count       = 1

  ip_allocation_policy {}

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  resource_labels = local.common_labels
}

resource "google_container_node_pool" "primary_nodes" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name       = "${local.name_prefix}-node-pool"
  location   = var.gcp_region
  cluster    = google_container_cluster.primary[0].name
  project    = var.gcp_project_id
  node_count = var.k8s_managed_node_count

  node_config {
    preemptible  = false
    machine_type = var.machine_type

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = local.common_labels
  }
}
