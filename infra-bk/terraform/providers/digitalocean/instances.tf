# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: APPLICATION DROPLETS (1 TO 5 NODES)
# Purpose:
#   Provisions 1 to 5 Ubuntu Linux Droplets in DigitalOcean.
# ==============================================================================

# Register administrative SSH key
resource "digitalocean_ssh_key" "admin" {
  name       = "${local.name_prefix}-admin-key"
  public_key = var.ssh_public_key
}

# 1 to 5 Application Droplets
resource "digitalocean_droplet" "app_nodes" {
  count = var.application_server_count

  name     = "${local.name_prefix}-app-${count.index + 1}"
  region   = var.do_region
  image    = "ubuntu-22-04-x64"
  size     = var.droplet_size
  vpc_uuid = digitalocean_vpc.main.id

  ssh_keys = [
    digitalocean_ssh_key.admin.id
  ]

  monitoring = true
  backups    = var.environment == "prod" ? true : false

  tags = concat(
    local.common_tags,
    [
      "role-application-server",
      "node-index-${count.index + 1}",
      count.index == 0 ? "role-control-plane" : "role-worker"
    ]
  )
}
