# ==============================================================================
# TEST FIXTURE: APPLICATION SERVER SIZING VALIDATION
# Purpose:
#   Offline, zero-cloud-dependency fixture to test variable validation rules
#   (1 to 5 nodes) without incurring network calls or cloud costs.
# ==============================================================================
terraform {
  required_version = ">= 1.5.0"
}

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

output "validated_count" {
  value = var.application_server_count
}
