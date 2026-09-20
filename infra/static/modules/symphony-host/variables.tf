variable "domain_name" {
  description = "Root DNS domain managed by Route 53."
  type        = string
}

variable "hosted_zone_id" {
  description = "Public Route 53 hosted zone ID."
  type        = string
}

variable "bootstrap_ref" {
  type = string
}

variable "runtime_ref" {
  type = string
}

variable "public_subnet_ids" {
  description = "Public subnet ids for the internet-facing Symphony EC2 instance."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) > 0
    error_message = "At least one public subnet ID is required."
  }
}

variable "vpc_id" {
  description = "VPC id for Symphony Host resources."
  type        = string
}
