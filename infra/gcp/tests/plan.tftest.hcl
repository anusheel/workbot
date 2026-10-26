# Plans both environments against a mocked Google provider: no account, no
# cost, and the same checks on every pull request.
mock_provider "google" {
  # The key's id, known at plan time so the resources it encrypts can be checked.
  mock_resource "google_kms_crypto_key" {
    override_during = plan
    defaults = {
      id = "projects/workbot/locations/us-central1/keyRings/workbot/cryptoKeys/data"
    }
  }
}

run "staging" {
  command = plan
  variables {
    project     = "workbot-staging"
    environment = "staging"
    domain      = "staging.workbot.example.com"
  }

  assert {
    condition     = google_sql_database_instance.workbot.settings[0].availability_type == "ZONAL"
    error_message = "Staging runs without a standby."
  }
  assert {
    condition     = !google_sql_database_instance.workbot.deletion_protection
    error_message = "Staging can be destroyed and made again."
  }
  assert {
    condition     = !google_sql_database_instance.workbot.settings[0].ip_configuration[0].ipv4_enabled
    error_message = "The database has no public address."
  }
}

run "production" {
  command = plan
  variables {
    project           = "workbot-prod"
    environment       = "production"
    domain            = "app.workbot.example.com"
    high_availability = true
    min_instances     = 1
  }

  assert {
    condition     = google_sql_database_instance.workbot.settings[0].availability_type == "REGIONAL"
    error_message = "Production keeps a standby in a second zone."
  }
  assert {
    condition     = google_sql_database_instance.workbot.deletion_protection
    error_message = "Production's database cannot be destroyed by an apply."
  }
  assert {
    condition     = google_compute_url_map.app.path_matcher[0].path_rule[0].paths == toset(["/realtime", "/realtime/*"])
    error_message = "The realtime server is served under /realtime on the app's host."
  }
  assert {
    condition     = google_sql_user.workbot.password_wo == null && google_secret_manager_secret_version.database_url.secret_data_wo == null
    error_message = "The database password is kept out of the plan and the state."
  }
  assert {
    condition     = alltrue([for k in ["app", "env"] : contains(keys(google_sql_database_instance.workbot.settings[0].user_labels), k)])
    error_message = "Billable resources carry the app and environment labels."
  }
}

run "single_tenant" {
  command = plan
  variables {
    project           = "workbot-harbor-dental"
    environment       = "production"
    customer          = "harbor-dental"
    domain            = "harbor-dental.workbot.example.com"
    high_availability = true
  }

  assert {
    condition     = anytrue([for rule in google_compute_url_map.app.host_rule : contains(rule.hosts, "harbor-dental.workbot.example.com")])
    error_message = "A tenant's stack answers on its own host."
  }
  assert {
    condition     = google_kms_crypto_key.data.rotation_period == "7776000s"
    error_message = "The environment's key rotates every 90 days."
  }
  assert {
    condition     = google_sql_database_instance.workbot.encryption_key_name == google_kms_crypto_key.data.id && google_secret_manager_secret.key["anthropic-api-key"].replication[0].auto[0].customer_managed_encryption[0].kms_key_name == google_kms_crypto_key.data.id
    error_message = "The database and the secrets are encrypted under the environment's key."
  }
  assert {
    condition     = length(google_project_iam_audit_config.reads) == 2
    error_message = "Reads of secrets and uses of the key are logged."
  }
}
