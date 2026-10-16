# ==============================================================================
# LOCAL DOCKER PROVIDER ADAPTER: STANDARDIZED CONTRACT OUTPUTS
# Purpose:
#   Maintains 1:1 schema parity with AWS and GCP outputs so Ansible and scripts
#   work identically without any code changes.
# ==============================================================================

output "provider_name" {
  description = "Name of the provider adapter."
  value       = "local"
}

output "environment" {
  description = "Target environment."
  value       = var.environment
}

output "application_server_count" {
  description = "Configured application server count (1-5)."
  value       = var.application_server_count
}

output "application_server_ids" {
  description = "List of container IDs for application servers."
  value       = docker_container.app_nodes[*].id
}

output "application_server_private_ips" {
  description = "IP addresses of local container nodes."
  value       = docker_container.app_nodes[*].network_data[0].ip_address
}

output "application_server_hostnames" {
  description = "Generated hostnames for local application servers."
  value       = docker_container.app_nodes[*].name
}

output "cluster_topology" {
  description = "Node role assignment for local clustering."
  value = {
    for idx, inst in docker_container.app_nodes :
    inst.name => (idx == 0 ? "control-plane" : "worker")
  }
}

output "load_balancer_dns" {
  description = "Local endpoint entrypoint."
  value       = "localhost:${var.app_port}"
}

output "inventory_metadata" {
  description = "Normalized data structure consumed by dynamic inventory generator."
  value = {
    provider    = "local"
    environment = var.environment
    mode        = var.deployment_mode
    hosts = [
      for idx, inst in docker_container.app_nodes : {
        name       = inst.name
        ansible_ip = inst.name
        role       = idx == 0 ? "control-plane" : "worker"
        is_primary = idx == 0
      }
    ]
  }
}
