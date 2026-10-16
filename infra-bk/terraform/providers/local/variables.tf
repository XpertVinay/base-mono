# ==============================================================================
# LOCAL DOCKER PROVIDER ADAPTER: INPUT VARIABLES
# Purpose:
#   Implements the standardized input contract for provisioning local
#   infrastructure via Docker containers without requiring any cloud credentials.
# ==============================================================================

variable "environment" {
  description = "Target environment."
  type        = string
  default     = "local"
}

variable "project_name" {
  description = "Unique namespace prefix applied to all local resources."
  type        = string
  default     = "platform"
}

# ==============================================================================
# APPLICATION SERVER COUNT CONSTRAINT (1 TO 5 ONLY)
# ==============================================================================
variable "application_server_count" {
  description = "Number of local container nodes to provision (1 to 5)."
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

variable "ssh_public_key" {
  description = "SSH public key content (optional for local docker execution)."
  type        = string
  default     = ""
}

variable "deployment_mode" {
  description = "Operational deployment architecture ('docker', 'k8s-self-managed')."
  type        = string
  default     = "docker"
}

variable "app_port" {
  description = "Target application listening port."
  type        = number
  default     = 8080
}
