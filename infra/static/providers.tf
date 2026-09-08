terraform {
  required_version = ">= 1.4.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31"
    }

    godaddy-dns = {
      source  = "veksh/godaddy-dns"
      version = "~> 0.3.12"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      managed_by = "terraform"
    }
  }
}

provider "godaddy-dns" {}
