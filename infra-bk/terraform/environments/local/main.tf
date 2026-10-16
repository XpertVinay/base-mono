# ==============================================================================
# ENVIRONMENT: LOCAL DOCKER (OFFLINE / LOCAL WORKSTATION TESTING)
# Purpose:
#   Zero cloud cost, zero cloud credentials test environment. Provisions
#   simulated nodes as Docker containers locally on your workstation.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

module "infrastructure" {
  source = "../../providers/local"

  environment              = "local"
  project_name             = var.project_name
  application_server_count = var.application_server_count
  deployment_mode          = var.deployment_mode
  app_port                 = var.app_port
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "environment" {
  value = "local"
}

output "application_server_count" {
  value = module.infrastructure.application_server_count
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
