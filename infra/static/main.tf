module "symphony_host" {
  source = "./modules/symphony-host"

  # The network and TLS resources are outside this snapshot.
  vpc_id             = var.vpc_id
  private_subnet_ids = var.private_subnet_ids
  public_subnet_ids  = var.public_subnet_ids
  certificate_arn    = var.certificate_arn

  deployment_stage   = var.deployment_stage
  domain_name        = var.domain_name
  oidc_client_id     = nonsensitive(local.symphony_google_oidc.client_id)
  oidc_client_secret = local.symphony_google_oidc.client_secret
}
