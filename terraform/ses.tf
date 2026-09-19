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

resource "aws_iam_user" "ses_sender" {
  name = "${local.project_name}-ses-sender"
}

resource "aws_iam_policy" "ses_sender" {
  name        = "${local.project_name}-ses-sender"
  description = "Allow Dear Paw to send transactional email through SES."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ses:SendEmail"
      Resource = aws_sesv2_email_identity.domain.arn
    }]
  })
}

resource "aws_iam_user_policy_attachment" "ses_sender" {
  user       = aws_iam_user.ses_sender.name
  policy_arn = aws_iam_policy.ses_sender.arn
}
