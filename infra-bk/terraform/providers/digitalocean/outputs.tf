# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: STANDARDIZED CONTRACT OUTPUTS
# Purpose:
#   Maintains 1:1 schema parity with AWS, GCP, Azure, and local adapters.
# ==============================================================================

output "provider_name" {
  description = "Name of the cloud provider adapter."
  value       = "digitalocean"
}

output "environment" {
  description = "Target environment."
  value       = var.environment
}

output "vpc_id" {
  description = "Identifier of the virtual network."
  value       = digitalocean_vpc.main.id
}

output "application_server_count" {
  description = "Configured application server count (1-5)."
  value       = var.application_server_count
}

output "application_server_ids" {
  description = "List of instance IDs for application Droplets."
  value       = digitalocean_droplet.app_nodes[*].id
}

output "application_server_private_ips" {
  description = "Private IP addresses for application nodes."
  value       = digitalocean_droplet.app_nodes[*].ipv4_address_private
}

output "application_server_public_ips" {
  description = "Public IP addresses for application nodes."
  value       = digitalocean_droplet.app_nodes[*].ipv4_address
}

output "application_server_hostnames" {
  description = "Generated hostnames for application servers."
  value       = digitalocean_droplet.app_nodes[*].name
}

output "cluster_topology" {
  description = "Node role assignment for self-managed clustering."
  value = {
    for idx, inst in digitalocean_droplet.app_nodes :
    inst.name => (idx == 0 ? "control-plane" : "worker")
  }
}

output "load_balancer_dns" {
  description = "Public IP / entrypoint for the load balancer."
  value       = var.enable_load_balancer ? digitalocean_loadbalancer.main[0].ip : (length(digitalocean_droplet.app_nodes) > 0 ? digitalocean_droplet.app_nodes[0].ipv4_address : "none")
}

output "managed_k8s_cluster_name" {
  description = "Name of the managed Kubernetes cluster if deployed."
  value       = var.deployment_mode == "k8s-managed" ? digitalocean_kubernetes_cluster.doks[0].name : "none"
}

output "managed_k8s_endpoint" {
  description = "API server endpoint for managed Kubernetes if deployed."
  value       = var.deployment_mode == "k8s-managed" ? digitalocean_kubernetes_cluster.doks[0].endpoint : "none"
}

output "inventory_metadata" {
  description = "Normalized data structure consumed by dynamic inventory generator."
  value = {
    provider    = "digitalocean"
    environment = var.environment
    mode        = var.deployment_mode
    hosts = [
      for idx, inst in digitalocean_droplet.app_nodes : {
        name       = inst.name
        ansible_ip = inst.ipv4_address
        role       = idx == 0 ? "control-plane" : "worker"
        is_primary = idx == 0
      }
    ]
  }
}
