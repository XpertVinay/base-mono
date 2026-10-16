# ==============================================================================
# GENERIC VPS PROVIDER ADAPTER: STANDARDIZED CONTRACT OUTPUTS
# Purpose:
#   Maintains 1:1 schema parity with cloud providers (AWS, GCP, Azure, DO)
#   so Ansible playbooks and scripts operate seamlessly on single-node VPS.
# ==============================================================================

output "provider_name" {
  description = "Name of the provider adapter."
  value       = "vps"
}

output "environment" {
  description = "Target environment."
  value       = var.environment
}

output "vpc_id" {
  description = "Virtual network identifier."
  value       = "vps-standalone-network"
}

output "application_server_count" {
  description = "Configured application server count (strictly 1 for single VPS)."
  value       = var.application_server_count
}

output "application_server_ids" {
  description = "List of instance IDs for the VPS."
  value       = ["vps-${var.vps_ipv4}"]
}

output "application_server_private_ips" {
  description = "IP address of the VPS instance."
  value       = [var.vps_ipv4]
}

output "application_server_public_ips" {
  description = "Public IP address of the VPS instance."
  value       = [var.vps_ipv4]
}

output "application_server_hostnames" {
  description = "Configured hostname for the VPS instance."
  value       = [var.vps_hostname]
}

output "cluster_topology" {
  description = "Node role assignment for single VPS deployment."
  value = {
    (var.vps_hostname) = "standalone"
  }
}

output "load_balancer_dns" {
  description = "Direct ingress entrypoint for the VPS."
  value       = var.vps_domain != "" ? "${var.vps_domain}:${var.app_port}" : "${var.vps_ipv4}:${var.app_port}"
}

output "managed_k8s_cluster_name" {
  description = "Name of the managed Kubernetes cluster if deployed."
  value       = "none"
}

output "managed_k8s_endpoint" {
  description = "API server endpoint for managed Kubernetes."
  value       = "none"
}

output "inventory_metadata" {
  description = "Normalized data structure consumed by dynamic inventory generator."
  value = {
    provider    = "vps"
    environment = var.environment
    mode        = var.deployment_mode
    hosts = [
      {
        name         = var.vps_hostname
        ansible_ip   = var.vps_ipv4
        role         = "standalone"
        is_primary   = true
        ansible_user = var.ssh_user
      }
    ]
  }
}
