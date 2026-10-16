# ==============================================================================
# ENVIRONMENT: PRODUCTION (PROD) - VARIABLES & OUTPUTS
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
  description = "Production server count (Default: 3, supports 1 to 5)."
  type        = number
  default     = 3

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
  default = "t3.large"
}

variable "ssh_public_key" {
  type = string
}

variable "admin_cidr_blocks" {
  description = "Administrative IP blocks (Must NOT be 0.0.0.0/0 in production)."
  type        = list(string)

  validation {
    condition     = !contains(var.admin_cidr_blocks, "0.0.0.0/0")
    error_message = "Production security policy forbids open 0.0.0.0/0 administrative access."
  }
}

variable "deployment_mode" {
  type    = string
  default = "k8s-managed"
}

variable "app_port" {
  type    = number
  default = 8080
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "environment" {
  value = "prod"
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
