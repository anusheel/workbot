variable "subscription_id" { type = string }

variable "environment" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus2"
}

variable "image" {
  description = "The web image by tag, from a registry the VM can pull."
  type        = string
}

variable "app_url" {
  description = "The address people reach the app at, in front of the load balancer."
  type        = string
}

variable "customer" {
  type    = string
  default = "fieldstone"
}

variable "ssh_public_key" {
  description = "Required by Azure for a Linux VM; no rule lets SSH in, so it serves only the serial console."
  type        = string
}

variable "size" {
  type    = string
  default = "Standard_B2s"
}
