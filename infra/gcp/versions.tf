terraform {
  required_version = ">= 1.11"

  # One bucket for every environment's state, a prefix each: never one state for
  # everything. Locking is the bucket's own. Given at init:
  #   terraform init -backend-config=bucket=<state bucket> -backend-config=prefix=<environment>
  backend "gcs" {}

  required_providers {
    google = { source = "hashicorp/google", version = "~> 7.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }
}
