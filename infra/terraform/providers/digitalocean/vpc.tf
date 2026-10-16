# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: VPC
# Purpose:
#   Provisions dedicated Virtual Private Cloud (VPC) network.
# ==============================================================================

resource "digitalocean_vpc" "main" {
  name        = "${local.name_prefix}-vpc"
  region      = var.do_region
  ip_range    = var.vpc_ip_range
  description = "Dedicated VPC for ${local.name_prefix} infrastructure tier"
}
