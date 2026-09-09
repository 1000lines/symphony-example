terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
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

}

output "instance_id" {
  value = aws_instance.symphony.id
}
