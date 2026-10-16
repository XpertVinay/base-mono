# ==============================================================================
# GCP PROVIDER ADAPTER: STANDARDIZED CONTRACT OUTPUTS
# Purpose:
#   Maintains 1:1 schema parity with the AWS adapter outputs.
# ==============================================================================

output "provider_name" {
  description = "Name of the cloud provider adapter."
  value       = "gcp"
}

output "environment" {
  description = "Target environment."
  value       = var.environment
}

output "vpc_id" {
  description = "Identifier of the virtual network."
  value       = google_compute_network.vpc.id
}

output "application_server_count" {
  description = "Configured application server count (1-5)."
  value       = var.application_server_count
}

output "application_server_ids" {
  description = "List of instance IDs for application servers."
  value       = google_compute_instance.app_nodes[*].instance_id
}

output "application_server_private_ips" {
  description = "Private IP addresses for application nodes."
  value       = google_compute_instance.app_nodes[*].network_interface[0].network_ip
}

output "application_server_hostnames" {
  description = "Generated hostnames for application servers."
  value       = google_compute_instance.app_nodes[*].name
}

output "cluster_topology" {
  description = "Node role assignment for self-managed Kubernetes clustering."
  value = {
    for idx, inst in google_compute_instance.app_nodes :
    inst.network_interface[0].network_ip => (idx == 0 ? "control-plane" : "worker")
  }
}

output "load_balancer_dns" {
  description = "Public IP/DNS for the ingress load balancer."
  value       = length(google_compute_instance.app_nodes) > 0 ? google_compute_instance.app_nodes[0].network_interface[0].access_config[0].nat_ip : "none"
}

output "managed_k8s_cluster_name" {
  description = "Name of the managed Kubernetes cluster if deployed."
  value       = var.deployment_mode == "k8s-managed" ? google_container_cluster.primary[0].name : "none"
}

output "managed_k8s_endpoint" {
  description = "API server endpoint for managed Kubernetes if deployed."
  value       = var.deployment_mode == "k8s-managed" ? google_container_cluster.primary[0].endpoint : "none"
}

output "inventory_metadata" {
  description = "Normalized data structure consumed by dynamic inventory generator."
  value = {
    provider    = "gcp"
    environment = var.environment
    mode        = var.deployment_mode
    hosts = [
      for idx, inst in google_compute_instance.app_nodes : {
        name       = inst.name
        ansible_ip = inst.network_interface[0].network_ip
        role       = idx == 0 ? "control-plane" : "worker"
        is_primary = idx == 0
      }
    ]
  }
}
