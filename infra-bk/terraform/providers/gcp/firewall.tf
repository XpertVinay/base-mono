# ==============================================================================
# GCP PROVIDER ADAPTER: FIREWALL RULES
# Purpose:
#   Enforces network isolation and traffic filtering for GCP Compute Engine nodes.
# ==============================================================================

# Allow SSH administrative access
resource "google_compute_firewall" "allow_ssh" {
  name    = "${local.name_prefix}-allow-ssh"
  network = google_compute_network.vpc.name
  project = var.gcp_project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.admin_source_ranges
  target_tags   = ["${local.name_prefix}-app-node"]
}

# Allow Internal Cluster Communication (Self-Managed Kubernetes / Service discovery)
resource "google_compute_firewall" "allow_internal" {
  name    = "${local.name_prefix}-allow-internal"
  network = google_compute_network.vpc.name
  project = var.gcp_project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [google_compute_subnetwork.subnet.ip_cidr_range]
  target_tags   = ["${local.name_prefix}-app-node"]
}

# Allow GCP Health Checks for Load Balancing
resource "google_compute_firewall" "allow_health_checks" {
  name    = "${local.name_prefix}-allow-health-checks"
  network = google_compute_network.vpc.name
  project = var.gcp_project_id

  allow {
    protocol = "tcp"
    ports    = ["80", "8080", "443"]
  }

  # Standard Google Cloud health check IP ranges
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["${local.name_prefix}-app-node"]
}
