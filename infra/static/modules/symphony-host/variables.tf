variable "certificate_arn" {
  description = "ACM wildcard certificate ARN used by the Symphony HTTPS listener."
  type        = string
}

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
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "At least two public subnet IDs in different availability zones are required."
  }
}

variable "vpc_id" {
  description = "VPC id for Symphony Host resources."
  type        = string
}
