resource "aws_secretsmanager_secret" "symphony_google_oidc" {
  name        = "symphony/oidc-credentials"
  description = "Google OIDC web client credentials for the Symphony Host ALB authenticate action."
}

data "aws_secretsmanager_secret_version" "symphony_google_oidc" {
  secret_id = aws_secretsmanager_secret.symphony_google_oidc.id
}

locals {
  symphony_google_oidc = jsondecode(data.aws_secretsmanager_secret_version.symphony_google_oidc.secret_string)
}
