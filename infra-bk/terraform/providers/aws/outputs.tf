# ==============================================================================
# AWS PROVIDER ADAPTER: STANDARDIZED CONTRACT OUTPUTS
# Purpose:
#   Exposes standardized outputs consumed by Ansible, deployment scripts,
#   and application CI/CD pipelines.
# Security:
#   Zero private keys or sensitive credentials are leaked through outputs.
# ==============================================================================

output "provider_name" {
  description = "Name of the cloud provider adapter."
  value       = "aws"
}

output "environment" {
  description = "Target environment."
  value       = var.environment
}

output "vpc_id" {
  description = "Identifier of the virtual network."
  value       = aws_vpc.main.id
}

output "application_server_count" {
  description = "Configured application server count (1-5)."
  value       = var.application_server_count
}

output "application_server_ids" {
  description = "List of instance IDs for application servers."
  value       = aws_instance.app_nodes[*].id
}

output "application_server_private_ips" {
  description = "Private IP addresses for application nodes (Consumed by Ansible)."
  value       = aws_instance.app_nodes[*].private_ip
}

output "application_server_hostnames" {
  description = "Generated hostnames for application servers."
  value = [
    for i in range(var.application_server_count) :
    "${local.name_prefix}-app-${i + 1}"
  ]
}

output "cluster_topology" {
  description = "Node role assignment for self-managed Kubernetes clustering."
  value = {
    for idx, inst in aws_instance.app_nodes :
    inst.private_ip => (idx == 0 ? "control-plane" : "worker")
  }
}

output "load_balancer_dns" {
  description = "Public DNS name for the Application Load Balancer."
  value       = var.enable_load_balancer ? aws_lb.main[0].dns_name : "none"
}

output "managed_k8s_cluster_name" {
  description = "Name of the managed Kubernetes cluster if deployed."
  value       = var.deployment_mode == "k8s-managed" ? aws_eks_cluster.main[0].name : "none"
}

output "managed_k8s_endpoint" {
  description = "API server endpoint for managed Kubernetes if deployed."
  value       = var.deployment_mode == "k8s-managed" ? aws_eks_cluster.main[0].endpoint : "none"
}

# Standardized inventory metadata block used by scripts/generate-inventory.sh
output "inventory_metadata" {
  description = "Normalized data structure consumed by dynamic inventory generator."
  value = {
    provider    = "aws"
    environment = var.environment
    mode        = var.deployment_mode
    hosts = [
      for idx, inst in aws_instance.app_nodes : {
        name       = "${local.name_prefix}-app-${idx + 1}"
        ansible_ip = inst.private_ip
        role       = idx == 0 ? "control-plane" : "worker"
        is_primary = idx == 0
      }
    ]
  }
}
