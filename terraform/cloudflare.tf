resource "cloudflare_d1_database" "app" {
  account_id            = var.cloudflare_account_id
  name                  = "${local.project_name}-app"
  primary_location_hint = var.d1_primary_location_hint

  read_replication = {
    mode = "auto"
  }
}

resource "cloudflare_r2_bucket" "assets" {
  account_id    = var.cloudflare_account_id
  name          = "${local.project_name}-assets"
  location      = var.r2_location
  storage_class = "Standard"
}

resource "cloudflare_r2_bucket_cors" "assets" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.assets.name

  rules = [{
    id = "browser-uploads"
    allowed = {
      methods = ["GET", "PUT", "HEAD"]
      origins = [
        "https://${var.domain_name}",
        "https://www.${var.domain_name}",
      ]
      headers = ["content-type", "content-length", "x-amz-content-sha256"]
    }
    expose_headers   = ["etag"]
    max_age_seconds = 3600
  }]
}

resource "cloudflare_queue" "jobs" {
  account_id = var.cloudflare_account_id
  queue_name = "${local.project_name}-jobs"
}

resource "cloudflare_turnstile_widget" "forms" {
  account_id      = var.cloudflare_account_id
  name            = "Dear Paw forms"
  domains         = local.turnstile_domains
  mode            = "managed"
  region          = "world"
  clearance_level = "no_clearance"
}

resource "cloudflare_dns_record" "ses_dkim" {
  count = 3

  zone_id = var.cloudflare_zone_id
  name    = "${local.ses_dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  content = "${local.ses_dkim_tokens[count.index]}.dkim.amazonses.com"
  ttl     = 300
  proxied = false
  comment = "SES Easy DKIM for ${var.domain_name}"
}

resource "cloudflare_dns_record" "ses_mail_from_mx" {
  zone_id  = var.cloudflare_zone_id
  name     = local.mail_from_domain
  type     = "MX"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  priority = 10
  ttl      = 300
  proxied  = false
  comment  = "SES custom MAIL FROM bounce handling"
}

resource "cloudflare_dns_record" "ses_mail_from_spf" {
  zone_id = var.cloudflare_zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  content = "v=spf1 include:amazonses.com ~all"
  ttl     = 300
  proxied = false
  comment = "SPF for SES custom MAIL FROM"
}

resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  content = "v=DMARC1; p=none; rua=mailto:postmaster@${var.domain_name}"
  ttl     = 300
  proxied = false
  comment = "Starter DMARC policy for SES; tighten after mail flow is verified"
}

