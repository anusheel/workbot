# The platform under WorkBot on any cluster: the Gateway API with Traefik
# serving it, KEDA for scaling on the queue, and the app's secrets. The app is
# the Helm chart in ../chart, installed by a release.

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = var.context
}

provider "helm" {
  kubernetes = {
    config_path    = "~/.kube/config"
    config_context = var.context
  }
}

# The Gateway API's resource types, at the version the Traefik chart is built
# against. Too large for a Helm release, which Helm keeps in one Secret.
data "http" "gateway_api" {
  url = "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.1/standard-install.yaml"
}

resource "kubernetes_manifest" "gateway_api" {
  for_each = {
    for m in provider::kubernetes::manifest_decode_multi(data.http.gateway_api.response_body) :
    "${m.kind}/${m.metadata.name}" => { for k, v in m : k => v if k != "status" }
  }
  manifest = each.value
}

resource "helm_release" "traefik" {
  name             = "traefik"
  repository       = "https://traefik.github.io/charts"
  chart            = "traefik"
  version          = "42.1.3"
  namespace        = "traefik"
  create_namespace = true
  skip_crds        = true
  values = [yamlencode({
    providers = {
      kubernetesGateway = { enabled = true }
      kubernetesCRD     = { enabled = false }
      kubernetesIngress = { enabled = false }
    }
    # Each app brings its own Gateway; the platform provides the class.
    gateway = { enabled = false }
    service = { spec = { type = var.gateway_service } }
    ports   = { web = { nodePort = 30080 } }
  })]
  depends_on = [kubernetes_manifest.gateway_api]
}

resource "helm_release" "keda" {
  name             = "keda"
  repository       = "https://kedacore.github.io/charts"
  chart            = "keda"
  version          = "2.21.0"
  namespace        = "keda"
  create_namespace = true
}

resource "kubernetes_namespace_v1" "workbot" {
  metadata { name = "workbot" }
}

resource "kubernetes_secret_v1" "workbot" {
  metadata {
    name      = "workbot"
    namespace = kubernetes_namespace_v1.workbot.metadata[0].name
  }
  data_wo          = var.secrets
  data_wo_revision = var.secrets_revision
}

# The database's password exists only while Terraform runs: it is written into
# the secret once, when the secret is made, and kept nowhere else.
ephemeral "random_password" "postgres" {
  length  = 32
  special = false
}

# By the service's full name, since KEDA reads the queue's depth from its own namespace.
locals {
  postgres = "postgres://postgres:${ephemeral.random_password.postgres.result}@postgres.workbot.svc.cluster.local:5432"
}

resource "kubernetes_secret_v1" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace_v1.workbot.metadata[0].name
  }
  data_wo = {
    POSTGRES_PASSWORD    = ephemeral.random_password.postgres.result
    DATABASE_URL         = "${local.postgres}/workbot?sslmode=disable"
    INNGEST_POSTGRES_URI = "${local.postgres}/inngest?sslmode=disable"
  }
  data_wo_revision = 1
}
