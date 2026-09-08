terraform {
  backend "s3" {
    bucket  = "example-symphony-tfstate"
    key     = "symphony/terraform.tfstate"
    encrypt = true
    region  = "us-west-2"
  }
}
