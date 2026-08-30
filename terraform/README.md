# Dear Paw Terraform

This directory is intended to be the Spacelift-monitored infrastructure root.

## What It Creates

- Cloudflare D1 database with read replication enabled.
- Cloudflare R2 bucket for private uploads, proofs, generated assets, videos, and model files.
- Cloudflare Queue for async jobs.
- Cloudflare Turnstile widget for public forms.
- AWS SES domain identity and transactional configuration set.
- Cloudflare DNS records required for SES Easy DKIM, custom MAIL FROM, SPF, and starter DMARC.

The Worker application and custom domain are intentionally not created yet because the web app build output and Worker entrypoint do not exist in the repository.

## Required Variables

Set these in Spacelift:

```hcl
cloudflare_account_id = "..."
cloudflare_zone_id    = "..."
```

Optional variables:

```hcl
aws_region               = "us-east-1"
domain_name              = "dearpaw.rip"
mail_from_subdomain      = "mail"
d1_primary_location_hint = "wnam"
r2_location              = null
```

## Required Credentials

- Cloudflare provider uses `CLOUDFLARE_API_TOKEN`.
- AWS provider uses the standard AWS provider credential chain configured in Spacelift.

## Notes

- If any DNS records already exist in Cloudflare, import them into Terraform state before applying.
- SES verification can take time after DNS records are created.
- The DMARC policy starts at `p=none`; tighten it only after SES sending is verified.
