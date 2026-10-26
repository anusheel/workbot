variable "context" {
  description = "The kubeconfig context of the cluster: kind-workbot locally, a GKE or EKS cluster's otherwise."
  type        = string
  default     = "kind-workbot"
}

variable "gateway_service" {
  description = "How the gateway is reached: NodePort on kind, mapped to port 3500; LoadBalancer on a cloud."
  type        = string
  default     = "NodePort"
}

variable "secrets" {
  description = "The app's keys, ANTHROPIC_API_KEY, SECRETS_KEY, INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY. Written to the cluster, never to the state or a plan."
  type        = map(string)
  ephemeral   = true
  sensitive   = true
}

variable "secrets_revision" {
  description = "Raise it to write changed keys; Terraform cannot compare what it never stored."
  type        = number
  default     = 1
}
