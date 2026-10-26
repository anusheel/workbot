terraform {
  required_version = ">= 1.11"

  # A storage account's container, locked by a blob lease. Given at init:
  #   terraform init -backend-config=storage_account_name=<account> -backend-config=key=<environment>.tfstate ...
  backend "azurerm" {}

  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}
