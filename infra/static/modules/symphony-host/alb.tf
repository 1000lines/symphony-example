resource "aws_security_group" "instance" {
  name        = "${local.name}-instance"
  description = "Symphony Host public HTTPS endpoint"
  vpc_id      = var.vpc_id

  tags = {
    Name = local.name
  }
}

resource "aws_security_group_rule" "instance_https_ingress" {
  type              = "ingress"
  security_group_id = aws_security_group.instance.id
  description       = "HTTPS from the internet"
  from_port         = 443
  protocol          = "tcp"
  to_port           = 443
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
}

resource "aws_security_group_rule" "instance_all_egress_ipv4" {
  type              = "egress"
  security_group_id = aws_security_group.instance.id
  description       = "Host outbound internet access"
  from_port         = 0
  protocol          = "-1"
  to_port           = 0
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_route53_record" "symphony" {
  zone_id = var.hosted_zone_id
  name    = local.fqdn
  type    = "A"

  ttl     = 60
  records = [aws_eip.symphony.public_ip]
}
