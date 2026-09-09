locals {
  # Pin the host AMI so unrelated infra/static applies cannot replace the
  # singleton host when AWS rolls the public "latest" AL2023 SSM parameter.
  # Weekly update PRs are proposed by update-symphony-host-ami.yml.
  # symphony-host-ami-update: begin, owned by update-symphony-host-ami.yml
  symphony_host_ami_id = "ami-0bea529386a62a2ad"
  # symphony-host-ami-update: end
}

resource "aws_instance" "symphony" {
  ami                         = local.symphony_host_ami_id
  associate_public_ip_address = false
  instance_type               = "m7i.xlarge"
  iam_instance_profile        = aws_iam_instance_profile.symphony.name
  subnet_id                   = var.private_subnet_ids[0]
  user_data                   = file("${path.module}/files/user-data.sh")
  vpc_security_group_ids      = [aws_security_group.instance.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 1
    http_tokens                 = "required"
    instance_metadata_tags      = "enabled"
  }

  root_block_device {
    delete_on_termination = true
    encrypted             = true
    volume_size           = 30
    volume_type           = "gp3"
  }

  # Decision: replace the disposable host when the user data changes so later
  # bootstrap edits rerun deterministically from a fresh root volume. Edits to
  # anything else in the bootstrap chain reach the host through the checkout and
  # cost no replacement.
  user_data_replace_on_change = true

  tags = {
    Name                     = local.name
    "symphony:bootstrap-ref" = var.bootstrap_ref
    "symphony:runtime-ref"   = var.runtime_ref
    "symphony:worker-slots"  = "4"
  }

  depends_on = [
    aws_iam_role_policy.symphony_runtime,
    aws_iam_role_policy_attachment.symphony_ssm_core,
  ]
}

resource "aws_lb_target_group_attachment" "symphony" {
  target_group_arn = aws_lb_target_group.symphony.arn
  target_id        = aws_instance.symphony.id
  port             = local.symphony_port
}
