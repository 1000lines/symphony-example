terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }

    godaddy-dns = {
      source = "veksh/godaddy-dns"
    }
  }
}

locals {
  dns_label     = "symphony"
  fqdn          = "${local.dns_label}.${var.domain_name}"
  name          = "symphony"
  symphony_port = 4000

  # Bootstrap extension contract for later script tickets: executable files
  # under scripts/symphony/host/hooks.d/ run lexicographically after core
  # bootstrap prerequisites and any nonzero hook exit fails bootstrap closed.

  oidc_authentication_request_extra_params = {
    hd = "example.invalid"
  }
}
