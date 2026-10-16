# ==============================================================================
# ENVIRONMENT: LOCAL DOCKER - VARIABLES
# ==============================================================================

variable "project_name" {
  description = "Project name prefix."
  type        = string
  default     = "platform"
}

variable "application_server_count" {
  description = "Number of local containers to provision (1 to 5)."
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

variable "deployment_mode" {
  type    = string
  default = "docker"
}

variable "app_port" {
  type    = number
  default = 8080
}
