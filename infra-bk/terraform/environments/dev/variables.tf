# ==============================================================================
# ENVIRONMENT: DEVELOPMENT (DEV) - VARIABLES
# ==============================================================================

variable "project_name" {
  description = "Project name prefix."
  type        = string
  default     = "platform"
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

# Strictly validated: 1 to 5 only
variable "application_server_count" {
  description = "Number of application servers (Dev default: 1)."
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
  description = "Instance sizing for dev workloads."
  type        = string
  default     = "t3.small"
}

variable "ssh_public_key" {
  description = "SSH public key content for administrative access."
  type        = string
}

variable "admin_cidr_blocks" {
  description = "Permitted administrative IP blocks."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "deployment_mode" {
  description = "Target runtime mode ('docker', 'k8s-self-managed', 'k8s-managed')."
  type        = string
  default     = "docker"
}

variable "enable_load_balancer" {
  description = "Enable load balancer in front of instances."
  type        = bool
  default     = true
}

variable "app_port" {
  description = "Target application listening port."
  type        = number
  default     = 8080
}
