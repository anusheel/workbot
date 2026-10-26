# Plans both environments against a mocked Google provider: no account, no
# cost, and the same checks on every pull request.
mock_provider "google" {}

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
