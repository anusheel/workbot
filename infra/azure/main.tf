# WorkBot's web tier on an Azure VM: Ubuntu, Docker, and a systemd unit that
# runs the image read-only, behind a Standard load balancer that probes its
# health. Its keys are in Key Vault, read with the VM's own identity.

provider "azurerm" {
  subscription_id = var.subscription_id
  features {}
}

data "azurerm_client_config" "current" {}

locals {
  name    = "workbot-${var.environment}"
  tags    = { app = "workbot", env = var.environment }
  secrets = ["anthropic-api-key", "database-url", "secrets-key", "inngest-event-key", "inngest-signing-key", "browser-url"]
}

resource "azurerm_resource_group" "workbot" {
  name     = local.name
  location = var.location
  tags     = local.tags
}

resource "azurerm_virtual_network" "workbot" {
  name                = local.name
  location            = var.location
  resource_group_name = azurerm_resource_group.workbot.name
  address_space       = ["10.20.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "web" {
  name                 = "web"
  resource_group_name  = azurerm_resource_group.workbot.name
  virtual_network_name = azurerm_virtual_network.workbot.name
  address_prefixes     = ["10.20.1.0/24"]
}

# Only the app's port, and only through the load balancer; nothing for SSH.
resource "azurerm_network_security_group" "web" {
  name                = local.name
  location            = var.location
  resource_group_name = azurerm_resource_group.workbot.name
  tags                = local.tags
  security_rule {
    name                       = "app"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "3000"
  }
}

resource "azurerm_subnet_network_security_group_association" "web" {
  subnet_id                 = azurerm_subnet.web.id
  network_security_group_id = azurerm_network_security_group.web.id
}

resource "azurerm_public_ip" "app" {
  name                = local.name
  location            = var.location
  resource_group_name = azurerm_resource_group.workbot.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.tags
}

resource "azurerm_lb" "app" {
  name                = local.name
  location            = var.location
  resource_group_name = azurerm_resource_group.workbot.name
  sku                 = "Standard"
  tags                = local.tags
  frontend_ip_configuration {
    name                 = "app"
    public_ip_address_id = azurerm_public_ip.app.id
  }
}

resource "azurerm_lb_backend_address_pool" "web" {
  name            = "web"
  loadbalancer_id = azurerm_lb.app.id
}

resource "azurerm_lb_probe" "health" {
  name            = "health"
  loadbalancer_id = azurerm_lb.app.id
  protocol        = "Http"
  port            = 3000
  request_path    = "/api/health"
}

resource "azurerm_lb_rule" "http" {
  name                           = "http"
  loadbalancer_id                = azurerm_lb.app.id
  protocol                       = "Tcp"
  frontend_port                  = 80
  backend_port                   = 3000
  frontend_ip_configuration_name = "app"
  backend_address_pool_ids       = [azurerm_lb_backend_address_pool.web.id]
  probe_id                       = azurerm_lb_probe.health.id
  disable_outbound_snat          = true
}

# New subnets have no default way out; the VM reaches the model's API and the
# registry through the load balancer's address.
resource "azurerm_lb_outbound_rule" "egress" {
  name                    = "egress"
  loadbalancer_id         = azurerm_lb.app.id
  protocol                = "All"
  backend_address_pool_id = azurerm_lb_backend_address_pool.web.id
  frontend_ip_configuration {
    name = "app"
  }
}

resource "azurerm_network_interface" "web" {
  name                = local.name
  location            = var.location
  resource_group_name = azurerm_resource_group.workbot.name
  tags                = local.tags
  ip_configuration {
    name                          = "web"
    subnet_id                     = azurerm_subnet.web.id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_network_interface_backend_address_pool_association" "web" {
  network_interface_id    = azurerm_network_interface.web.id
  ip_configuration_name   = "web"
  backend_address_pool_id = azurerm_lb_backend_address_pool.web.id
}

# The keys: Terraform makes the vault, an operator adds each secret with
# `az keyvault secret set`, and the VM reads them with its own identity.
resource "azurerm_key_vault" "workbot" {
  name                       = "${local.name}-keys"
  location                   = var.location
  resource_group_name        = azurerm_resource_group.workbot.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = var.environment == "production"
  tags                       = local.tags
}

resource "azurerm_linux_virtual_machine" "web" {
  name                            = local.name
  location                        = var.location
  resource_group_name             = azurerm_resource_group.workbot.name
  size                            = var.size
  admin_username                  = "workbot"
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.web.id]
  tags                            = local.tags
  custom_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
    image    = var.image
    vault    = azurerm_key_vault.workbot.name
    secrets  = join(" ", local.secrets)
    customer = var.customer
    app_url  = var.app_url
  }))

  admin_ssh_key {
    username   = "workbot"
    public_key = var.ssh_public_key
  }
  identity {
    type = "SystemAssigned"
  }
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}

resource "azurerm_role_assignment" "read_keys" {
  scope                = azurerm_key_vault.workbot.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_virtual_machine.web.identity[0].principal_id
}
