terraform {
  backend "s3" {
    bucket         = "1000lines-350353785278-tfstate"
    key            = "symphony/terraform.tfstate"
    encrypt        = true
    region         = "us-west-2"
    profile        = "1000lines-terraform"
    dynamodb_table = "1000lines-terraform-locks"
  }
}
