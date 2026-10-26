# One Cloud Run service: an image by tag, on the project's network so it
# reaches the database's private address, its secrets read from Secret Manager,
# and traffic only from the load balancer.
resource "google_cloud_run_v2_service" "this" {
  name                 = var.name
  location             = var.region
  ingress              = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  invoker_iam_disabled = true
  deletion_protection  = var.deletion_protection
  labels               = var.labels

  template {
    service_account = var.service_account
    timeout         = "${var.timeout}s"
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = "default"
        subnetwork = "default"
      }
    }
    containers {
      image   = var.image
      command = var.command
      ports {
        container_port = var.port
      }
      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = var.secrets
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

  # A release changes the image with `gcloud run deploy`; Terraform owns the rest.
  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }
}
