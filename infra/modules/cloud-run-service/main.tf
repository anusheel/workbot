# One Cloud Run service on the project's network, so it reaches the database's
# private address, with its secrets read from Secret Manager and traffic only
# from the load balancer. It starts on Google's placeholder image; a release
# (infra/gcp/release.sh) puts WorkBot's image and command on it.
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
      image = "us-docker.pkg.dev/cloudrun/container/hello"
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

  # The image and the command are the release's; Terraform owns the rest.
  lifecycle {
    ignore_changes = [template[0].containers[0].image, template[0].containers[0].command, template[0].containers[0].args, client, client_version]
  }
}
