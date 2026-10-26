# WorkBot on Google Cloud, one environment per project: Postgres with a private
# address, the secrets, the images' registry, the web and realtime services,
# and a load balancer that serves both under one host.

provider "google" {
  project = var.project
  region  = var.region
}

locals {
  labels  = { app = "workbot", env = var.environment }
  images  = "${var.region}-docker.pkg.dev/${var.project}/workbot"
  secrets = ["anthropic-api-key", "secrets-key", "inngest-event-key", "inngest-signing-key", "browser-url"]
  apis    = ["run", "sqladmin", "secretmanager", "artifactregistry", "servicenetworking", "compute"]
  # The environment variables each secret fills, for the web tier and the jobs.
  app_secrets = {
    DATABASE_URL        = "database-url"
    ANTHROPIC_API_KEY   = "anthropic-api-key"
    SECRETS_KEY         = "secrets-key"
    INNGEST_EVENT_KEY   = "inngest-event-key"
    INNGEST_SIGNING_KEY = "inngest-signing-key"
    BROWSER_URL         = "browser-url"
  }
}

resource "google_project_service" "api" {
  for_each           = toset(local.apis)
  service            = "${each.value}.googleapis.com"
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  repository_id = "workbot"
  location      = var.region
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.api]
}

# The database's private address, on the project's default network.
resource "google_compute_global_address" "services" {
  name          = "google-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = "default"
  depends_on    = [google_project_service.api]
}

resource "google_service_networking_connection" "services" {
  network                 = "projects/${var.project}/global/networks/default"
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.services.name]
}

resource "google_sql_database_instance" "workbot" {
  name                = "workbot-${var.environment}"
  database_version    = "POSTGRES_17"
  deletion_protection = var.environment == "production"
  settings {
    edition           = "ENTERPRISE"
    tier              = var.database_tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    user_labels       = local.labels
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_service_networking_connection.services.network
    }
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
    }
  }
}

resource "google_sql_database" "workbot" {
  name     = "workbot"
  instance = google_sql_database_instance.workbot.name
}

# The password exists while Terraform runs and in Secret Manager, never in the
# state: both take it as a write-only argument.
ephemeral "random_password" "database" {
  length  = 32
  special = false
}

resource "google_sql_user" "workbot" {
  name                = "workbot"
  instance            = google_sql_database_instance.workbot.name
  password_wo         = ephemeral.random_password.database.result
  password_wo_version = 1
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.api]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret                 = google_secret_manager_secret.database_url.id
  secret_data_wo         = "postgres://workbot:${ephemeral.random_password.database.result}@${google_sql_database_instance.workbot.private_ip_address}:5432/workbot"
  secret_data_wo_version = 1
}

# The keys Terraform never sees: it makes the secrets, and an operator adds
# each value with `gcloud secrets versions add <id> --data-file=-`.
resource "google_secret_manager_secret" "key" {
  for_each  = toset(local.secrets)
  secret_id = each.value
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.api]
}

resource "google_service_account" "workbot" {
  account_id   = "workbot-run"
  display_name = "WorkBot services"
}

resource "google_secret_manager_secret_iam_member" "read" {
  for_each  = merge({ "database-url" = google_secret_manager_secret.database_url.id }, { for k, s in google_secret_manager_secret.key : k => s.id })
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.workbot.email}"
}

module "web" {
  source          = "../modules/cloud-run-service"
  name            = "workbot-web"
  region          = var.region
  service_account = google_service_account.workbot.email
  min_instances   = var.min_instances
  labels          = merge(local.labels, { tier = "web" })
  env = {
    CUSTOMER     = var.customer
    APP_URL      = "https://${var.domain}"
    REALTIME_URL = "wss://${var.domain}/realtime"
  }
  secrets    = local.app_secrets
  depends_on = [google_secret_manager_secret_iam_member.read, google_secret_manager_secret_version.database_url]
}

module "realtime" {
  source          = "../modules/cloud-run-service"
  name            = "workbot-realtime"
  region          = var.region
  port            = 8080
  service_account = google_service_account.workbot.email
  min_instances   = 1
  max_instances   = 4
  timeout         = 3600
  labels          = merge(local.labels, { tier = "realtime" })
  env             = { APP_URL = "https://${var.domain}", CUSTOMER = var.customer }
  secrets         = { DATABASE_URL = "database-url" }
  depends_on      = [google_secret_manager_secret_iam_member.read, google_secret_manager_secret_version.database_url]
}

# What a release runs with the new tools image before any traffic moves: the
# schema and the knowledge base, then the eval smoke suite.
resource "google_cloud_run_v2_job" "release" {
  for_each = {
    migrate = ["node", "--import", "tsx", "cli/index-knowledge.ts"]
    smoke   = ["node", "--import", "tsx", "cli/eval.ts", "--task", "all", "--smoke", "--runs", "2", "--gate"]
  }
  name                = "workbot-${each.key}"
  location            = var.region
  deletion_protection = false
  labels              = local.labels
  template {
    template {
      service_account = google_service_account.workbot.email
      max_retries     = 0
      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = "default"
          subnetwork = "default"
        }
      }
      containers {
        image   = "us-docker.pkg.dev/cloudrun/container/job"
        command = each.value
        env {
          name  = "CUSTOMER"
          value = var.customer
        }
        dynamic "env" {
          for_each = local.app_secrets
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }
    }
  }
  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image, client, client_version]
  }
  depends_on = [google_secret_manager_secret_iam_member.read]
}

# One host for both services: /realtime to the realtime server, the rest to the
# web tier. The session cookie reaches the realtime server as it is.
resource "google_compute_region_network_endpoint_group" "service" {
  for_each              = { web = module.web.name, realtime = module.realtime.name }
  name                  = "workbot-${each.key}"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = each.value
  }
}

resource "google_compute_backend_service" "service" {
  for_each              = google_compute_region_network_endpoint_group.service
  name                  = "workbot-${each.key}"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  backend {
    group = each.value.id
  }
}

resource "google_compute_url_map" "app" {
  name            = "workbot"
  default_service = google_compute_backend_service.service["web"].id
  host_rule {
    hosts        = [var.domain]
    path_matcher = "app"
  }
  path_matcher {
    name            = "app"
    default_service = google_compute_backend_service.service["web"].id
    path_rule {
      paths   = ["/realtime", "/realtime/*"]
      service = google_compute_backend_service.service["realtime"].id
    }
  }
}

resource "google_compute_managed_ssl_certificate" "app" {
  name = "workbot"
  managed {
    domains = [var.domain]
  }
}

resource "google_compute_target_https_proxy" "app" {
  name             = "workbot"
  url_map          = google_compute_url_map.app.id
  ssl_certificates = [google_compute_managed_ssl_certificate.app.id]
}

resource "google_compute_global_address" "app" {
  name = "workbot"
}

resource "google_compute_global_forwarding_rule" "app" {
  name                  = "workbot"
  target                = google_compute_target_https_proxy.app.id
  ip_address            = google_compute_global_address.app.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  labels                = local.labels
}
