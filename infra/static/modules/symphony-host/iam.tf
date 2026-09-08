data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  symphony_secret_names = [
    "symphony/runtime-credentials",
    "symphony-google-service-account-json",
  ]

  symphony_secret_arns = [
    for name in local.symphony_secret_names :
    "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${name}-??????"
  ]
}

data "aws_iam_policy_document" "symphony_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"

    principals {
      identifiers = ["ec2.amazonaws.com"]
      type        = "Service"
    }
  }
}

data "aws_iam_policy_document" "symphony_runtime" {
  statement {
    sid    = "ReadNamedRuntimeSecrets"
    effect = "Allow"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
    ]
    resources = local.symphony_secret_arns
  }
}

resource "aws_iam_role" "symphony" {
  name               = "${local.name}-instance"
  assume_role_policy = data.aws_iam_policy_document.symphony_assume_role.json
}

resource "aws_iam_role_policy_attachment" "symphony_ssm_core" {
  role       = aws_iam_role.symphony.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "symphony_runtime" {
  name   = "runtime-access"
  role   = aws_iam_role.symphony.id
  policy = data.aws_iam_policy_document.symphony_runtime.json
}

resource "aws_iam_instance_profile" "symphony" {
  name = "${local.name}-instance"
  role = aws_iam_role.symphony.name
}
