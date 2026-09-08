resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Symphony Host public HTTPS ingress"
  vpc_id      = var.vpc_id

  tags = {
    Name = local.name
  }
}

resource "aws_security_group" "instance" {
  name        = "${local.name}-instance"
  description = "Symphony Host private EC2 target"
  vpc_id      = var.vpc_id

  tags = {
    Name = local.name
  }
}

resource "aws_security_group_rule" "alb_https_ingress" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the internet"
  from_port         = 443
  protocol          = "tcp"
  to_port           = 443
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
}

resource "aws_security_group_rule" "alb_to_instance_egress" {
  type                     = "egress"
  security_group_id        = aws_security_group.alb.id
  description              = "Authenticated Symphony traffic to private EC2"
  from_port                = local.symphony_port
  protocol                 = "tcp"
  to_port                  = local.symphony_port
  source_security_group_id = aws_security_group.instance.id
}

resource "aws_security_group_rule" "alb_oidc_egress" {
  type              = "egress"
  security_group_id = aws_security_group.alb.id
  description       = "Google OIDC HTTPS endpoints"
  from_port         = 443
  protocol          = "tcp"
  to_port           = 443
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
}

resource "aws_security_group_rule" "instance_from_alb_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.instance.id
  description              = "Symphony dashboard/API traffic from ALB only"
  from_port                = local.symphony_port
  protocol                 = "tcp"
  to_port                  = local.symphony_port
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "instance_all_egress_ipv4" {
  type              = "egress"
  security_group_id = aws_security_group.instance.id
  description       = "Private instance outbound through VPC routing"
  from_port         = 0
  protocol          = "-1"
  to_port           = 0
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_lb" "symphony" {
  name               = local.name
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = {
    Name = local.name
  }
}

resource "aws_lb_target_group" "symphony" {
  name        = local.name
  port        = local.symphony_port
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    healthy_threshold   = 5
    interval            = 30
    matcher             = "200-399"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = local.name
  }
}

resource "aws_lb_listener" "https" {
  certificate_arn   = var.certificate_arn
  load_balancer_arn = aws_lb.symphony.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Symphony host header required"
      status_code  = "404"
    }
  }

  tags = {
    Name = local.name
  }
}

resource "aws_lb_listener_rule" "symphony_host" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    order = 1
    type  = "authenticate-oidc"

    authenticate_oidc {
      authorization_endpoint              = "https://accounts.google.com/o/oauth2/v2/auth"
      authentication_request_extra_params = local.oidc_authentication_request_extra_params
      client_id                           = var.oidc_client_id
      client_secret                       = var.oidc_client_secret
      issuer                              = "https://accounts.google.com"
      on_unauthenticated_request          = "authenticate"
      scope                               = "openid email profile"
      session_cookie_name                 = "symphony_host_oidc"
      session_timeout                     = 604800
      token_endpoint                      = "https://oauth2.googleapis.com/token"
      user_info_endpoint                  = "https://openidconnect.googleapis.com/v1/userinfo"
    }
  }

  action {
    order            = 2
    target_group_arn = aws_lb_target_group.symphony.arn
    type             = "forward"
  }

  condition {
    host_header {
      values = [local.fqdn]
    }
  }

  tags = {
    Name = local.name
  }
}

resource "godaddy-dns_record" "symphony" {
  data   = aws_lb.symphony.dns_name
  domain = var.domain_name
  name   = local.dns_label
  ttl    = 600
  type   = "CNAME"
}
