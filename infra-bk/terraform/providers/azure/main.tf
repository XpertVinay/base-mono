# ==============================================================================
# AZURE PROVIDER ADAPTER: CORE CONFIGURATION
# Purpose:
#   Configures the Terraform Azure provider, baseline locals, and resource groups.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.80.0, < 5.0.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Platform    = "ProviderAgnosticIaC"
      Mode        = var.deployment_mode
    },
    var.tags
  )
}

# Dedicated Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-rg"
  location = var.azure_location
  tags     = local.common_tags
}
