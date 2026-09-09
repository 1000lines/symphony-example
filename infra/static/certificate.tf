data "aws_route53_zone" "domain" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_acm_certificate" "symphony" {
  domain_name       = "symphony.${var.domain_name}"
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.symphony.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
  zone_id = data.aws_route53_zone.domain.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "symphony" {
  certificate_arn         = aws_acm_certificate.symphony.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}
