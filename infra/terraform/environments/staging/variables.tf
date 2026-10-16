# ==============================================================================
# ENVIRONMENT: STAGING - VARIABLES & OUTPUTS
# ==============================================================================

variable "project_name" {
  type    = string
  default = "platform"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "application_server_count" {
  description = "Application server capacity (Staging default: 2)."
  type        = number
  default     = 2

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
  type    = string
  default = "t3.medium"
}

variable "ssh_public_key" {
  type = string
}

variable "admin_cidr_blocks" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "deployment_mode" {
  type    = string
  default = "k8s-self-managed"
}

variable "app_port" {
  type    = number
  default = 8080
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "environment" {
  value = "staging"
}

output "application_server_count" {
  value = module.infrastructure.application_server_count
}

output "application_server_private_ips" {
  value = module.infrastructure.application_server_private_ips
}

output "load_balancer_dns" {
  value = module.infrastructure.load_balancer_dns
}

output "inventory_metadata" {
  value = module.infrastructure.inventory_metadata
}
