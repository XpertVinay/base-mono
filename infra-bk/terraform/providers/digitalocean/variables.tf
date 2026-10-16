# ==============================================================================
# DIGITALOCEAN PROVIDER ADAPTER: INPUT VARIABLES
# Purpose:
#   Defines the standardized input contract for provisioning infrastructure on DigitalOcean.
# Architectural Principle:
#   Enforces validation, environment boundaries, and application server scaling
#   constraints (1 to 5 nodes).
# ==============================================================================

variable "environment" {
  description = "Target deployment environment (dev, staging, prod, local)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod", "local"], var.environment)
    error_message = "Environment must be one of: 'dev', 'staging', 'prod', 'local'."
  }
}

variable "project_name" {
  description = "Unique namespace prefix applied to all DigitalOcean resources."
  type        = string
  default     = "platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase alphanumeric characters and hyphens."
  }
}

variable "do_region" {
  description = "Target DigitalOcean datacenter region (e.g. nyc3, sfo3, ams3, blr1)."
  type        = string
  default     = "nyc3"
}

# ==============================================================================
# APPLICATION SERVER COUNT CONSTRAINT (STRICT: 1 TO 5 ONLY)
# ==============================================================================
variable "application_server_count" {
  description = "Number of standalone application Droplets to provision (minimum 1, maximum 5)."
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

variable "droplet_size" {
  description = "DigitalOcean Droplet slug sizing (e.g., s-1vcpu-2gb, s-2vcpu-4gb)."
  type        = string
  default     = "s-2vcpu-4gb"
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

variable "vpc_ip_range" {
  description = "CIDR IP range for the DigitalOcean VPC network."
  type        = string
  default     = "10.100.0.0/20"
}

variable "enable_load_balancer" {
  description = "Whether to provision a DigitalOcean Load Balancer."
  type        = bool
  default     = true
}

variable "app_port" {
  description = "Target port on which the application container listens."
  type        = number
  default     = 8888
}

variable "deployment_mode" {
  description = "Operational deployment architecture: 'docker', 'k8s-self-managed', or 'k8s-managed'."
  type        = string
  default     = "docker"

  validation {
    condition     = contains(["docker", "k8s-self-managed", "k8s-managed"], var.deployment_mode)
    error_message = "deployment_mode must be one of: 'docker', 'k8s-self-managed', 'k8s-managed'."
  }
}

variable "tags" {
  description = "Additional tags applied to resources."
  type        = list(string)
  default     = []
}
