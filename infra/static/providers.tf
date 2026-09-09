terraform {
  required_version = ">= 1.4.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31"
    }

  }
}

provider "aws" {
  region              = var.aws_region
  profile             = var.aws_profile
  allowed_account_ids = ["350353785278"]

  default_tags {
    tags = {
      managed_by = "terraform"
      project    = "1000lines-symphony"
    }
  }
}
