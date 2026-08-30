resource "aws_sesv2_configuration_set" "transactional" {
  configuration_set_name = "${local.project_name}-transactional"
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.domain_name
  configuration_set_name = aws_sesv2_configuration_set.transactional.configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  behavior_on_mx_failure = "REJECT_MESSAGE"
  mail_from_domain       = local.mail_from_domain
}

