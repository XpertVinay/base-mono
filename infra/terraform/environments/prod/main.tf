# ==============================================================================
# ENVIRONMENT: PRODUCTION (PROD)
# Purpose:
#   Entrypoint for provisioning production infrastructure.
# Security & Reliability:
#   - Deletion protection on databases & load balancers.
#   - Application server count defaults to 3 for multi-AZ fault tolerance.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  # Production MUST use remote state with DynamoDB locking
  # backend "s3" {
  #   bucket         = "platform-tf-state-prod"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "platform-tf-locks-prod"
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

  default_tags {
    tags = {
      Environment = "prod"
      Compliance  = "SOC2"
      ManagedBy   = "Terraform"
    }
  }
}

module "infrastructure" {
  source = "../../providers/aws"

  environment              = "prod"
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
    CostCenter = "ProductionWorkloads"
  }
}
