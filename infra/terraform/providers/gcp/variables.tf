# ==============================================================================
# GCP PROVIDER ADAPTER: INPUT VARIABLES
# Purpose:
#   Implements the standardized input contract for provisioning infrastructure on GCP.
# Architectural Principle:
#   Maintains 1:1 variable parity with the AWS adapter, validating
#   application_server_count strictly between 1 and 5.
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
}

variable "gcp_project_id" {
  description = "GCP Project ID in which resources will be provisioned."
  type        = string
}

variable "gcp_region" {
  description = "GCP region for deployment (e.g., us-central1)."
  type        = string
  default     = "us-central1"
}

variable "gcp_zone" {
  description = "GCP zone for deployment (e.g., us-central1-a)."
  type        = string
  default     = "us-central1-a"
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

variable "machine_type" {
  description = "Compute Engine machine type for application instances."
  type        = string
  default     = "e2-medium"
}

variable "boot_disk_size_gb" {
  description = "Size of boot disk in gigabytes."
  type        = number
  default     = 30
}

variable "ssh_user" {
  description = "Default SSH administrative username."
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key" {
  description = "SSH public key content for administrative access."
  type        = string
}

variable "admin_source_ranges" {
  description = "Source IP ranges permitted for SSH access."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

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
  description = "Worker node count if managed Kubernetes (GKE) is selected."
  type        = number
  default     = 2
}

variable "labels" {
  description = "Labels applied across all created GCP resources."
  type        = map(string)
  default     = {}
}
