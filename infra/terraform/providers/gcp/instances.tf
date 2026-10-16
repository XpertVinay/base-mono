# ==============================================================================
# GCP PROVIDER ADAPTER: COMPUTE ENGINE INSTANCES
# Purpose:
#   Provisions 1 to 5 Google Compute Engine virtual machine instances with
#   consistent naming, metadata, and persistent disk attachments.
# ==============================================================================

# Boot disk image lookup: Ubuntu 22.04 LTS
data "google_compute_image" "ubuntu" {
  family  = "ubuntu-2204-lts"
  project = "ubuntu-os-cloud"
}

# Standalone Application Server Compute Instances (Count: 1 to 5)
resource "google_compute_instance" "app_nodes" {
  count = var.application_server_count

  name         = "${local.name_prefix}-app-${count.index + 1}"
  machine_type = var.machine_type
  zone         = var.gcp_zone
  project      = var.gcp_project_id

  tags = ["${local.name_prefix}-app-node"]

  boot_disk {
    initialize_params {
      image = data.google_compute_image.ubuntu.self_link
      size  = var.boot_disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = google_compute_network.vpc.id
    subnetwork = google_compute_subnetwork.subnet.id
    # Public IP allocated for direct access if in non-production, otherwise routed via NAT
    access_config {}
  }

  metadata = {
    ssh-keys     = "${var.ssh_user}:${var.ssh_public_key}"
    role         = "application-server"
    cluster-role = count.index == 0 ? "control-plane" : "worker"
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e
    apt-get update -y
    apt-get install -y python3 python3-pip curl jq
    echo "Host bootstrap script finished." > /var/log/provision-init.log
  EOF

  labels = merge(
    local.common_labels,
    {
      node_index   = tostring(count.index + 1)
      cluster_role = count.index == 0 ? "control_plane" : "worker"
    }
  )
}

# Persistent Data Disk per instance
resource "google_compute_disk" "data_disks" {
  count = var.application_server_count

  name    = "${local.name_prefix}-app-${count.index + 1}-data"
  type    = "pd-balanced"
  zone    = var.gcp_zone
  size    = 20
  project = var.gcp_project_id

  labels = local.common_labels
}

resource "google_compute_attached_disk" "data_attachments" {
  count = var.application_server_count

  disk     = google_compute_disk.data_disks[count.index].id
  instance = google_compute_instance.app_nodes[count.index].id
  zone     = var.gcp_zone
  project  = var.gcp_project_id
}
