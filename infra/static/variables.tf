variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "aws_profile" {
  type    = string
  default = "1000lines-terraform"
}

variable "domain_name" {
  description = "Root DNS domain managed in Route 53."
  type        = string
  default     = "1000lines.dev"
}

variable "deploy_host" {
  description = "Enable after runtime credentials are populated and bootstrap code is pushed."
  type        = bool
  default     = true
}

variable "bootstrap_ref" {
  description = "Reviewed commit SHA of this repository used to install the host."
  type        = string
  default     = "57175c8921245e7c76d410f83fe2d09dbdca7b21"
}

variable "runtime_ref" {
  description = "Pinned commit of 1000lines/symphony."
  type        = string
  default     = "e4d3f6a05b0a00201c9d04d3ceca02b206e22de5"
}
