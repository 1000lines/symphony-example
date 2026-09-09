module "symphony_host" {
  source = "./modules/symphony-host"
  count  = var.deploy_host ? 1 : 0

  vpc_id             = aws_vpc.symphony.id
  private_subnet_ids = [aws_subnet.private.id]
  public_subnet_ids  = aws_subnet.public[*].id
  certificate_arn    = aws_acm_certificate_validation.symphony.certificate_arn

  domain_name    = var.domain_name
  hosted_zone_id = data.aws_route53_zone.domain.zone_id
  bootstrap_ref  = var.bootstrap_ref
  runtime_ref    = var.runtime_ref

  depends_on = [
    aws_route.private_outbound,
    aws_route_table_association.private,
    aws_route_table_association.public,
    aws_secretsmanager_secret.runtime,
  ]
}

output "dashboard_url" {
  value = "https://symphony.${var.domain_name}"
}

output "instance_id" {
  value = var.deploy_host ? module.symphony_host[0].instance_id : null
}

output "runtime_secret_arn" {
  value = aws_secretsmanager_secret.runtime.arn
}
