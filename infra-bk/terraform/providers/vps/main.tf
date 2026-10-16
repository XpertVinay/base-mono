# ==============================================================================
# GENERIC VPS PROVIDER ADAPTER: CORE CONFIGURATION
# Purpose:
#   Manages single-server VPS infrastructure (Hostinger, Contabo, OVH, etc.)
#   without requiring proprietary cloud APIs.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      Provider    = "vps"
      ManagedBy   = "Terraform"
      Platform    = "ProviderAgnosticIaC"
      Mode        = var.deployment_mode
    },
    var.tags
  )
}
