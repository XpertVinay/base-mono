# ==============================================================================
# ENVIRONMENT: DEVELOPMENT (DEV)
# Purpose:
#   Entrypoint for provisioning the development environment.
# Defaults:
#   - application_server_count: 1 (Cost-effective standalone profile)
#   - deployment_mode: "docker"
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  # For remote state, configure an S3 or GCS backend:
  # backend "s3" {
  #   bucket         = "platform-tf-state-dev"
  #   key            = "dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "platform-tf-locks-dev"
  #   encrypt        = true
  # }

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

  environment              = "dev"
  project_name             = var.project_name
  aws_region               = var.aws_region
  application_server_count = var.application_server_count
  instance_type            = var.instance_type
  ssh_public_key           = var.ssh_public_key
  admin_cidr_blocks        = var.admin_cidr_blocks
  deployment_mode          = var.deployment_mode
  enable_load_balancer     = var.enable_load_balancer
  app_port                 = var.app_port

  tags = {
    Environment = "dev"
    Owner       = "dev-team"
  }
}
