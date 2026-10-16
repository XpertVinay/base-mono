# ==============================================================================
# ENVIRONMENT: STAGING
# Purpose:
#   Entrypoint for provisioning the staging testbed.
# Defaults:
#   - application_server_count: 2 (Distributed setup for testing multi-node sync)
#   - deployment_mode: "k8s-self-managed"
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "infrastructure" {
  source = "../../providers/aws"

  environment              = "staging"
  project_name             = var.project_name
  aws_region               = var.aws_region
  application_server_count = var.application_server_count
  instance_type            = var.instance_type
  ssh_public_key           = var.ssh_public_key
  admin_cidr_blocks        = var.admin_cidr_blocks
  deployment_mode          = var.deployment_mode
  enable_load_balancer     = true
  app_port                 = var.app_port

  tags = {
    Environment = "staging"
    Owner       = "qa-team"
  }
}
