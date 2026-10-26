output "address" {
  description = "Point the domain's A record here."
  value       = google_compute_global_address.app.address
}

output "images" {
  description = "Where the release pushes the web and tools images."
  value       = local.images
}
