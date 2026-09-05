resource "cloudflare_zero_trust_access_policy" "admin_email" {
  account_id = var.cloudflare_account_id
  name       = "Dear Paw admin email allowlist"
  decision   = "allow"

  include = [
    for email in var.admin_emails : {
      email = {
        email = email
      }
    }
  ]
}

resource "cloudflare_zero_trust_access_application" "admin" {
  account_id               = var.cloudflare_account_id
  name                     = "Dear Paw admin"
  type                     = "self_hosted"
  domain                   = "${var.domain_name}/admin*"
  session_duration         = "24h"
  path_cookie_attribute    = true
  app_launcher_visible     = false
  skip_interstitial        = true
  options_preflight_bypass = true

  policies = [{
    id         = cloudflare_zero_trust_access_policy.admin_email.id
    precedence = 1
  }]
}

resource "cloudflare_zero_trust_access_application" "admin_api" {
  account_id               = var.cloudflare_account_id
  name                     = "Dear Paw admin API"
  type                     = "self_hosted"
  domain                   = "${var.domain_name}/api/admin*"
  session_duration         = "24h"
  path_cookie_attribute    = true
  app_launcher_visible     = false
  skip_interstitial        = true
  options_preflight_bypass = true

  policies = [{
    id         = cloudflare_zero_trust_access_policy.admin_email.id
    precedence = 1
  }]
}
