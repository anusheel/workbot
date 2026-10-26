variable "project" {
  description = "The environment's own project."
  type        = string
}

variable "environment" {
  description = "staging or production; it names and labels everything."
  type        = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "domain" {
  description = "The host people reach the app at; its DNS points at the load balancer's address."
  type        = string
}

variable "customer" {
  type    = string
  default = "fieldstone"
}

variable "database_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "high_availability" {
  description = "A standby in a second zone, which doubles the database's price."
  type        = bool
  default     = false
}

variable "min_instances" {
  description = "Web instances kept running; 0 lets an idle environment cost nothing."
  type        = number
  default     = 0
}

variable "billing_account" {
  description = "The billing account the environment's budget watches."
  type        = string
}

variable "monthly_budget" {
  description = "Dollars a month before the billing admins hear of it; Day 34's estimate is $240 at 1,000 users."
  type        = number
  default     = 300
}
