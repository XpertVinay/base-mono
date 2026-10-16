# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: LOAD BALANCER
# Purpose:
#   Provisions a DigitalOcean Load Balancer distributing traffic across the
#   1 to 5 application Droplets.
# ==============================================================================

resource "digitalocean_loadbalancer" "main" {
  count = var.enable_load_balancer ? 1 : 0

  name     = "${local.name_prefix}-lb"
  region   = var.do_region
  vpc_uuid = digitalocean_vpc.main.id

  forwarding_rule {
    entry_port     = var.app_port
    entry_protocol = "http"

    target_port     = var.app_port
    target_protocol = "http"
  }

  healthcheck {
    port     = var.app_port
    protocol = "http"
    path     = "/health"

    check_interval_seconds   = 10
    response_timeout_seconds = 5
    unhealthy_threshold      = 3
    healthy_threshold        = 2
  }

  droplet_ids = digitalocean_droplet.app_nodes[*].id
}
