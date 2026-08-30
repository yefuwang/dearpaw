variable "aws_region" {
  description = "AWS region for SES."
  type        = string
  default     = "us-east-1"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the Dear Paw domain."
  type        = string
}

variable "domain_name" {
  description = "Primary Dear Paw domain."
  type        = string
  default     = "dearpaw.rip"
}

variable "mail_from_subdomain" {
  description = "Subdomain used for SES custom MAIL FROM."
  type        = string
  default     = "mail"
}

variable "d1_primary_location_hint" {
  description = "Preferred D1 primary location. Use a Cloudflare-supported region such as wnam, enam, weur, eeur, apac, or oc."
  type        = string
  default     = "wnam"
}

variable "r2_location" {
  description = "Preferred R2 bucket location. Leave null to let Cloudflare choose."
  type        = string
  default     = null
}
