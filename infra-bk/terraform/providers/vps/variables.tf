# ==============================================================================
# GENERIC VPS PROVIDER ADAPTER: INPUT VARIABLES
# Purpose:
#   Defines the input contract for single-server VPS hosting (Hostinger,
#   Contabo, Hetzner, OVH, or any standard Linux VPS).
# Architecture:
#   Strict single server instance architecture optimized for cost-effective
#   standalone container workloads.
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
  description = "Unique namespace prefix applied to the platform configuration."
  type        = string
  default     = "platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase alphanumeric characters and hyphens."
  }
}

# ==============================================================================
# SINGLE SERVER INSTANCE CONSTRAINT (STRICTLY 1 NODE FOR VPS ARCHITECTURE)
# ==============================================================================
variable "application_server_count" {
  description = "Number of VPS instances. Generic VPS architecture strictly requires single server instance (count = 1)."
  type        = number
  default     = 1

  validation {
    condition     = var.application_server_count == 1
    error_message = "Generic VPS provider architecture strictly requires a single server instance (application_server_count must be 1)."
  }
}

variable "vps_ipv4" {
  description = "Public IPv4 address of the VPS provided by your hosting provider (e.g. Hostinger)."
  type        = string
  default     = "127.0.0.1"

  validation {
    condition     = can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$", var.vps_ipv4))
    error_message = "vps_ipv4 must be a valid IPv4 address."
  }
}

variable "vps_hostname" {
  description = "Hostname or identifier for the VPS instance."
  type        = string
  default     = "vps-app-1"
}

variable "ssh_user" {
  description = "Administrative user for SSH authentication (e.g., 'root' or 'ubuntu')."
  type        = string
  default     = "root"
}

variable "ssh_port" {
  description = "SSH port for administrative access."
  type        = number
  default     = 22
}

variable "ssh_public_key" {
  description = "SSH public key content for administrative OS access."
  type        = string
  default     = ""
}

variable "ssh_private_key_path" {
  description = "Path to the SSH private key used for remote verification and Ansible connectivity."
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "vps_domain" {
  description = "Optional public domain or subdomain mapped to this VPS IP."
  type        = string
  default     = ""
}

variable "app_port" {
  description = "Target port on which the application container listens."
  type        = number
  default     = 8888
}

variable "deployment_mode" {
  description = "Operational deployment architecture: 'docker' standalone (recommended for single VPS)."
  type        = string
  default     = "docker"

  validation {
    condition     = contains(["docker", "k8s-self-managed"], var.deployment_mode)
    error_message = "deployment_mode for single VPS must be 'docker' or 'k8s-self-managed'."
  }
}

variable "verify_ssh_connectivity" {
  description = "Whether Terraform should actively test SSH connectivity during apply."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Metadata tags/labels for the VPS instance."
  type        = map(string)
  default     = {}
}
