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

# A namespace per tenant: "workbot" for the shared deployment, and one for each
# customer who must be kept apart, each with its own secrets, database and
# password, and a policy that admits traffic only from inside it, the gateway
# and KEDA.
resource "kubernetes_namespace_v1" "tenant" {
  for_each = var.tenants
  metadata { name = each.key }
}

resource "kubernetes_network_policy_v1" "tenant" {
  for_each = kubernetes_namespace_v1.tenant
  metadata {
    name      = "isolate"
    namespace = each.key
  }
  spec {
    pod_selector {}
    policy_types = ["Ingress"]
    ingress {
      from {
        pod_selector {}
      }
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "traefik" }
        }
      }
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "keda" }
        }
      }
    }
  }
}

resource "kubernetes_secret_v1" "workbot" {
  for_each = kubernetes_namespace_v1.tenant
  metadata {
    name      = "workbot"
    namespace = each.key
  }
  data_wo          = var.secrets
  data_wo_revision = var.secrets_revision
}

# Each database's password exists only while Terraform runs: it is written into
# the secret once, when the secret is made, and kept nowhere else.
ephemeral "random_password" "postgres" {
  for_each = var.tenants
  length   = 32
  special  = false
}

# By the service's full name, since KEDA reads the queue's depth from its own namespace.
resource "kubernetes_secret_v1" "postgres" {
  for_each = kubernetes_namespace_v1.tenant
  metadata {
    name      = "postgres"
    namespace = each.key
  }
  data_wo = {
    POSTGRES_PASSWORD    = ephemeral.random_password.postgres[each.key].result
    DATABASE_URL         = "postgres://postgres:${ephemeral.random_password.postgres[each.key].result}@postgres.${each.key}.svc.cluster.local:5432/workbot?sslmode=disable"
    INNGEST_POSTGRES_URI = "postgres://postgres:${ephemeral.random_password.postgres[each.key].result}@postgres.${each.key}.svc.cluster.local:5432/inngest?sslmode=disable"
  }
  data_wo_revision = 1
}

moved {
  from = kubernetes_namespace_v1.workbot
  to   = kubernetes_namespace_v1.tenant["workbot"]
}

moved {
  from = kubernetes_secret_v1.workbot
  to   = kubernetes_secret_v1.workbot["workbot"]
}

moved {
  from = kubernetes_secret_v1.postgres
  to   = kubernetes_secret_v1.postgres["workbot"]
}
