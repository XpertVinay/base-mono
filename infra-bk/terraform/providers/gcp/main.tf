# ==============================================================================
# GCP PROVIDER ADAPTER: CORE & VPC NETWORKING
# Purpose:
#   Configures the Google Cloud provider, custom VPC, and regional subnetwork.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_labels = merge(
    {
      project     = var.project_name
      environment = var.environment
      managed_by  = "terraform"
      mode        = replace(var.deployment_mode, "-", "_")
    },
    var.labels
  )
}

# Custom VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.gcp_project_id
}

# Regional Subnetwork
resource "google_compute_subnetwork" "subnet" {
  name          = "${local.name_prefix}-subnet"
  ip_cidr_range = "10.10.0.0/20"
  region        = var.gcp_region
  network       = google_compute_network.vpc.id
  project       = var.gcp_project_id

  private_ip_google_access = true
}

# Cloud Router and NAT for private instance internet egress
resource "google_compute_router" "router" {
  name    = "${local.name_prefix}-router"
  region  = var.gcp_region
  network = google_compute_network.vpc.name
  project = var.gcp_project_id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${local.name_prefix}-nat"
  router                             = google_compute_router.router.name
  region                             = var.gcp_region
  project                            = var.gcp_project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
