locals {
  project_name      = "dearpaw"
  worker_name       = "dearpaw"
  mail_from_domain  = "${var.mail_from_subdomain}.${var.domain_name}"
  ses_dkim_tokens   = tolist(aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens)
  turnstile_domains = [var.domain_name, "www.${var.domain_name}"]

  tags = {
    Project   = "Dear Paw"
    ManagedBy = "Terraform"
  }
}
