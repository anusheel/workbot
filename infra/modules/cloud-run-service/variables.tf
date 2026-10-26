variable "name" { type = string }
variable "region" { type = string }
variable "image" { type = string }
variable "service_account" { type = string }

variable "port" {
  type    = number
  default = 3000
}

variable "command" {
  description = "The command, when it is not the image's own."
  type        = list(string)
  default     = null
}

variable "env" {
  type    = map(string)
  default = {}
}

variable "secrets" {
  description = "Environment variable name to Secret Manager secret id."
  type        = map(string)
  default     = {}
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 10
}

variable "timeout" {
  description = "Seconds a request may take; a WebSocket closes at it."
  type        = number
  default     = 300
}

variable "labels" {
  type    = map(string)
  default = {}
}

variable "deletion_protection" {
  type    = bool
  default = true
}
