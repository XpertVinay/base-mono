# ==============================================================================
# AZURE PROVIDER ADAPTER: INPUT VARIABLES
# Purpose:
#   Defines the standardized input contract for provisioning infrastructure on Microsoft Azure.
# Architectural Principle:
#   Enforces validation, environment boundaries, and application server scaling
#   constraints (1 to 5 nodes).
# ==============================================================================

variable "environment" {
  description = "Target deployment environment (dev, staging, prod, or custom)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod", "local"], var.environment)
    error_message = "Environment must be one of: 'dev', 'staging', 'prod', 'local'."
  }
}

variable "project_name" {
  description = "Unique namespace prefix applied to all Azure resources."
  type        = string
  default     = "platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase alphanumeric characters and hyphens."
  }
}

variable "azure_location" {
  description = "Target Azure datacenter region."
  type        = string
  default     = "eastus"
}

# ==============================================================================
# APPLICATION SERVER COUNT CONSTRAINT (STRICT: 1 TO 5 ONLY)
# ==============================================================================
variable "application_server_count" {
  description = "Number of standalone application VMs to provision (minimum 1, maximum 5)."
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

variable "vm_size" {
  description = "Azure VM SKU size (e.g., Standard_B2s, Standard_D2s_v5)."
  type        = string
  default     = "Standard_B2s"
}

variable "os_disk_size_gb" {
  description = "Size of the OS disk in GB."
  type        = number
  default     = 30

  validation {
    condition     = var.os_disk_size_gb >= 30 && var.os_disk_size_gb <= 500
    error_message = "OS disk size must be between 30 GB and 500 GB."
  }
}

variable "admin_username" {
  description = "Administrator username for Linux VMs."
  type        = string
  default     = "ubuntu"
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

variable "vnet_cidr" {
  description = "Base CIDR block for the Virtual Network."
  type        = string
  default     = "10.10.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the application subnet."
  type        = string
  default     = "10.10.1.0/24"
}

variable "enable_load_balancer" {
  description = "Whether to provision an Azure Load Balancer in front of application instances."
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
  description = "Additional tags applied to Azure resources."
  type        = map(string)
  default     = {}
}
