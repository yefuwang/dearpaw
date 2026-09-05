output "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the Dear Paw domain."
  value       = cloudflare_zone.site.id
}

output "cloudflare_name_servers" {
  description = "Cloudflare-assigned authoritative name servers. Configure these at the domain registrar."
  value       = cloudflare_zone.site.name_servers
}

output "worker_custom_domain" {
  description = "Hostname attached to the Dear Paw Worker."
  value       = cloudflare_workers_custom_domain.apex.hostname
}

output "admin_access_domains" {
  description = "Cloudflare Access protected admin path patterns."
  value = [
    cloudflare_zero_trust_access_application.admin.domain,
    cloudflare_zero_trust_access_application.admin_api.domain,
  ]
}

output "d1_database_id" {
  description = "Cloudflare D1 database ID."
  value       = cloudflare_d1_database.app.id
}

output "d1_database_name" {
  description = "Cloudflare D1 database name."
  value       = cloudflare_d1_database.app.name
}

output "r2_assets_bucket_name" {
  description = "R2 bucket for private customer uploads and generated assets."
  value       = cloudflare_r2_bucket.assets.name
}

output "jobs_queue_name" {
  description = "Cloudflare Queue for async application jobs."
  value       = cloudflare_queue.jobs.queue_name
}

output "turnstile_sitekey" {
  description = "Public Turnstile sitekey for forms."
  value       = cloudflare_turnstile_widget.forms.sitekey
}

output "ses_identity_arn" {
  description = "SES domain identity ARN."
  value       = aws_sesv2_email_identity.domain.arn
}

output "ses_dkim_tokens" {
  description = "SES Easy DKIM tokens, also used to create Cloudflare CNAME records."
  value       = local.ses_dkim_tokens
}
