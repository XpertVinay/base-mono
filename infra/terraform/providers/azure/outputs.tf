# ==============================================================================
# AZURE PROVIDER ADAPTER: STANDARDIZED CONTRACT OUTPUTS
# Purpose:
#   Maintains 1:1 schema parity with AWS, GCP, and local adapters so Ansible
#   and deployment scripts operate identically across providers.
# ==============================================================================

output "provider_name" {
  description = "Name of the cloud provider adapter."
  value       = "azure"
}

output "environment" {
  description = "Target environment."
  value       = var.environment
}

output "vpc_id" {
  description = "Identifier of the virtual network."
  value       = azurerm_virtual_network.main.id
}

output "application_server_count" {
  description = "Configured application server count (1-5)."
  value       = var.application_server_count
}

output "application_server_ids" {
  description = "List of instance IDs for application servers."
  value       = azurerm_linux_virtual_machine.app_nodes[*].id
}

output "application_server_private_ips" {
  description = "Private IP addresses for application nodes."
  value       = azurerm_network_interface.app_nodes[*].private_ip_address
}

output "application_server_public_ips" {
  description = "Public IP addresses for application nodes."
  value       = azurerm_public_ip.app_nodes[*].ip_address
}

output "application_server_hostnames" {
  description = "Generated hostnames for application servers."
  value       = azurerm_linux_virtual_machine.app_nodes[*].name
}

output "cluster_topology" {
  description = "Node role assignment for self-managed clustering."
  value = {
    for idx, inst in azurerm_linux_virtual_machine.app_nodes :
    inst.name => (idx == 0 ? "control-plane" : "worker")
  }
}

output "load_balancer_dns" {
  description = "Public IP / entrypoint for the load balancer."
  value       = var.enable_load_balancer ? azurerm_public_ip.lb[0].ip_address : (length(azurerm_public_ip.app_nodes) > 0 ? azurerm_public_ip.app_nodes[0].ip_address : "none")
}

output "managed_k8s_cluster_name" {
  description = "Name of the managed Kubernetes cluster if deployed."
  value       = var.deployment_mode == "k8s-managed" ? azurerm_kubernetes_cluster.aks[0].name : "none"
}

output "managed_k8s_endpoint" {
  description = "API server endpoint for managed Kubernetes if deployed."
  value       = var.deployment_mode == "k8s-managed" ? azurerm_kubernetes_cluster.aks[0].kube_config[0].host : "none"
}

output "inventory_metadata" {
  description = "Normalized data structure consumed by dynamic inventory generator."
  value = {
    provider    = "azure"
    environment = var.environment
    mode        = var.deployment_mode
    hosts = [
      for idx, inst in azurerm_linux_virtual_machine.app_nodes : {
        name       = inst.name
        ansible_ip = azurerm_public_ip.app_nodes[idx].ip_address
        role       = idx == 0 ? "control-plane" : "worker"
        is_primary = idx == 0
      }
    ]
  }
}
