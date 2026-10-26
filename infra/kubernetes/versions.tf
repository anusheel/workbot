terraform {
  required_version = ">= 1.11"

  # Remote and locked: the state lives in Postgres, outside the cluster it
  # describes, and a second apply waits for the first. PG_CONN_STR names it.
  backend "pg" {}

  required_providers {
    helm       = { source = "hashicorp/helm", version = "~> 3.1" }
    http       = { source = "hashicorp/http", version = "~> 3.5" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.38" }
    random     = { source = "hashicorp/random", version = "~> 3.7" }
  }
}
