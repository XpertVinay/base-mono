# ==============================================================================
# ENVIRONMENT: DEVELOPMENT (DEV) - OUTPUTS
# ==============================================================================

output "environment" {
  value = "dev"
}

output "application_server_count" {
  value = module.infrastructure.application_server_count
}

output "application_server_private_ips" {
  value = module.infrastructure.application_server_private_ips
}

output "application_server_hostnames" {
  value = module.infrastructure.application_server_hostnames
}

output "load_balancer_dns" {
  value = module.infrastructure.load_balancer_dns
}

output "inventory_metadata" {
  value = module.infrastructure.inventory_metadata
}
