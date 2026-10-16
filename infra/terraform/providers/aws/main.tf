# ==============================================================================
# AWS PROVIDER ADAPTER: CORE CONFIGURATION
# Purpose:
#   Configures the Terraform AWS provider, baseline locals, and OS AMI lookup.
# Architectural Principle:
#   Pins required provider versions and standardizes resource naming and tags.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
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

# Fetch supported Availability Zones in the current region
data "aws_availability_zones" "available" {
  state = "available"
}

# Canonical Ubuntu 22.04 LTS (Jammy) AMI Lookup
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical owner ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
