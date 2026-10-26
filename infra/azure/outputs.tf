output "address" {
  description = "The load balancer's address, for the domain's A record."
  value       = azurerm_public_ip.app.ip_address
}
