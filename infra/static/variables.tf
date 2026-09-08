variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "deployment_stage" {
  type = string
}

variable "domain_name" {
  description = "Root DNS domain managed in GoDaddy."
  type        = string
  default     = "example.invalid"
}

# Inputs for infrastructure omitted from this snapshot. See README.md.
variable "vpc_id" {
  description = "Existing VPC containing the Symphony host and ALB subnets."
  type        = string
}

variable "private_subnet_ids" {
  description = "Existing private subnet IDs; the host uses the first subnet."
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Existing public ALB subnet IDs in at least two availability zones."
  type        = list(string)
}

variable "certificate_arn" {
  description = "Existing ACM certificate ARN covering the Symphony hostname in the host region."
  type        = string
}
