variable "certificate_arn" {
  description = "ACM wildcard certificate ARN used by the Symphony HTTPS listener."
  type        = string
}

variable "deployment_stage" {
  description = "Static deployment stage resource suffix."
  type        = string
}

variable "domain_name" {
  description = "Root DNS domain managed by GoDaddy."
  type        = string
}

variable "oidc_client_id" {
  description = "Google OIDC client id for the Symphony ALB."
  type        = string
}

variable "oidc_client_secret" {
  description = "Google OIDC client secret for the Symphony ALB. Do not commit a value."
  type        = string
  sensitive   = true
}

variable "private_subnet_ids" {
  description = "Private subnet ids for the Symphony EC2 instance."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) > 0
    error_message = "At least one private subnet id is required."
  }
}

variable "public_subnet_ids" {
  description = "Public subnet ids for the internet-facing Symphony ALB."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) > 0
    error_message = "At least one public subnet id is required."
  }
}

variable "vpc_id" {
  description = "VPC id for Symphony Host resources."
  type        = string
}
