# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: CLOUD FIREWALL
# Purpose:
#   Implements strict stateful packet filtering for application Droplets.
# ==============================================================================

resource "digitalocean_firewall" "app" {
  name = "${local.name_prefix}-firewall"

  droplet_ids = digitalocean_droplet.app_nodes[*].id

  # Inbound SSH restricted to administrator CIDRs
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.admin_cidr_blocks
  }

  # Inbound Application Port
  inbound_rule {
    protocol         = "tcp"
    port_range       = tostring(var.app_port)
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Inbound HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Inbound HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Inbound ICMP ping
  inbound_rule {
    protocol         = "icmp"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Outbound rules - permit all egress
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
