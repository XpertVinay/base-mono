# ==============================================================================
# AWS PROVIDER ADAPTER: INPUT VARIABLES
# Purpose:
#   Defines the standardized input contract for provisioning infrastructure on AWS.
# Architectural Principle:
#   Enforces validation, environment boundaries, and application server scaling
#   constraints (1 to 5 nodes).
# ==============================================================================

variable "environment" {
  description = "Target deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: 'dev', 'staging', 'prod'."
  }
}

variable "project_name" {
  description = "Unique namespace prefix applied to all infrastructure resources."
  type        = string
  default     = "platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase alphanumeric characters and hyphens."
  }
}

variable "aws_region" {
  description = "Target AWS region for infrastructure deployment."
  type        = string
  default     = "us-east-1"
}

# ==============================================================================
# APPLICATION SERVER COUNT CONSTRAINT (REQUIREMENT: 1 TO 5 ONLY)
# ==============================================================================
variable "application_server_count" {
  description = "Number of standalone application servers to provision (minimum 1, maximum 5)."
  type        = number
  default     = 1

  validation {
    condition = (
      var.application_server_count >= 1 &&
      var.application_server_count <= 5 &&
      var.application_server_count == floor(var.application_server_count)
    )
    error_message = "application_server_count must be an integer from 1 through 5."
  }
}

variable "instance_type" {
  description = "EC2 instance family and sizing for application servers."
  type        = string
  default     = "t3.medium"
}

variable "root_volume_size_gb" {
  description = "Size of root EBS volume in gigabytes."
  type        = number
  default     = 30

  validation {
    condition     = var.root_volume_size_gb >= 20 && var.root_volume_size_gb <= 500
    error_message = "Root volume size must be between 20 GB and 500 GB."
  }
}

variable "ssh_public_key" {
  description = "SSH public key content for administrative OS access."
  type        = string
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks permitted for administrative SSH access (Must NOT be 0.0.0.0/0 in production)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vpc_cidr" {
  description = "Base CIDR block for the Virtual Private Cloud."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Subnet CIDR blocks for public internet-facing tier."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Subnet CIDR blocks for isolated application tier."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "enable_load_balancer" {
  description = "Whether to provision an Application Load Balancer in front of application instances."
  type        = bool
  default     = true
}

variable "app_port" {
  description = "Target port on which the application container listens."
  type        = number
  default     = 8080
}

# ==============================================================================
# DEPLOYMENT MODE & KUBERNETES CONFIGURATION
# ==============================================================================
variable "deployment_mode" {
  description = "Operational deployment architecture: 'docker', 'k8s-self-managed', or 'k8s-managed'."
  type        = string
  default     = "docker"

  validation {
    condition     = contains(["docker", "k8s-self-managed", "k8s-managed"], var.deployment_mode)
    error_message = "Deployment mode must be 'docker', 'k8s-self-managed', or 'k8s-managed'."
  }
}

variable "k8s_managed_node_count" {
  description = "Worker node count if managed Kubernetes (EKS) is selected (Separate from application_server_count)."
  type        = number
  default     = 2
}

variable "tags" {
  description = "Custom metadata tags applied across all created AWS resources."
  type        = map(string)
  default     = {}
}
