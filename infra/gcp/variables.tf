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

variable "tag" {
  description = "The images' tag at creation; releases change it afterwards."
  type        = string
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
