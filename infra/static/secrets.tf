# Values are installed separately so API keys never enter Terraform state.
resource "aws_secretsmanager_secret" "runtime" {
  name        = "symphony/keys"
  description = "Symphony GitHub, Linear and OpenAI API credentials."
}

resource "aws_secretsmanager_secret" "symphony_github_app" {
  name        = "symphony/github-apps/symphony"
  description = "Symphony GitHub App signing configuration, populated outside Terraform."
}
