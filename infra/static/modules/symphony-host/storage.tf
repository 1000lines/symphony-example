locals {
  # EC2 requires a block-device mapping name for attachment. The host mount
  # path is discovered by filesystem label or single blank disk, not this name.
  workspace_device_name     = "/dev/sdf"
  workspace_volume_size_gib = 400
  workspace_volume_type     = "gp3"
}

data "aws_subnet" "symphony" {
  id = var.private_subnet_ids[0]
}

resource "aws_ebs_volume" "workspace" {
  availability_zone = data.aws_subnet.symphony.availability_zone
  encrypted         = true
  final_snapshot    = false
  size              = local.workspace_volume_size_gib
  type              = local.workspace_volume_type

  tags = {
    Name = local.name
  }
}

resource "aws_volume_attachment" "workspace" {
  device_name                    = local.workspace_device_name
  force_detach                   = false
  instance_id                    = aws_instance.symphony.id
  stop_instance_before_detaching = true
  volume_id                      = aws_ebs_volume.workspace.id
}
