# Plans the VM against a mocked Azure provider: no subscription, no cost.
mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = { tenant_id = "00000000-0000-0000-0000-000000000000" }
  }
}

run "staging" {
  command = plan
  variables {
    subscription_id = "00000000-0000-0000-0000-000000000000"
    environment     = "staging"
    image           = "ghcr.io/anusheel/workbot-web:5307a60"
    app_url         = "https://azure.workbot.example.com"
    ssh_public_key  = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ5ZtKIi1kZQWc6YQ6s7a0kP0eW1nJb3gQx2HcVb6T4n workbot"
  }

  assert {
    condition     = azurerm_lb_rule.http.frontend_port == 80 && azurerm_lb_rule.http.backend_port == 3000
    error_message = "The load balancer takes port 80 to the app's 3000."
  }
  assert {
    condition     = azurerm_lb_probe.health.request_path == "/api/health"
    error_message = "A VM leaves the pool when its health check fails."
  }
  assert {
    condition     = alltrue([for r in azurerm_network_security_group.web.security_rule : r.destination_port_range != "22"])
    error_message = "No rule lets SSH in."
  }
  assert {
    condition     = strcontains(base64decode(azurerm_linux_virtual_machine.web.custom_data), "--read-only --tmpfs /tmp --tmpfs /app/.next/cache --cap-drop ALL")
    error_message = "The unit runs the image read-only, with no capabilities."
  }
  assert {
    condition     = azurerm_linux_virtual_machine.web.identity[0].type == "SystemAssigned"
    error_message = "The VM reads its keys with its own identity, not a stored credential."
  }
}
