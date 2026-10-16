# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: CORE CONFIGURATION
# Purpose:
#   Configures the Terraform DigitalOcean provider and baseline locals.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.30"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = concat(
    [
      "project-${var.project_name}",
      "env-${var.environment}",
      "managed-by-terraform",
      "mode-${var.deployment_mode}"
    ],
    var.tags
  )
}
