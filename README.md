# Dear Paw

Custom wooden pet memorial website.

## Stack

- Astro + React islands
- Cloudflare Workers with Static Assets
- Cloudflare D1, R2, Queues, and Turnstile bindings
- AWS SES for transactional email
- Terraform/OpenTofu infrastructure in `terraform/`

## Local Development

Use Node 22.19 or newer.

```sh
npm install
npm run dev
```

The dev server runs at:

```text
http://127.0.0.1:4321
```

## Checks

```sh
npm run build
npm audit
```

## Infrastructure

Spacelift watches the `terraform/` root. See `terraform/README.md` for required variables and provider credentials.

## Secret Ownership

Keep application secrets in the GitHub Actions `production` environment, not in Terraform variables or state. The production deploy workflow copies any configured values to the Workers with `wrangler secret put`; unset values are skipped.

Configure these GitHub Actions environment secrets as needed:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SES_ACCESS_KEY_ID`
- `SES_SECRET_ACCESS_KEY`
- `SES_FROM_EMAIL`
- `SES_REGION`
- `SES_ADMIN_EMAIL`

Spacelift should contain only Terraform/OpenTofu inputs and provider credentials, such as `TF_VAR_cloudflare_account_id`, `TF_VAR_domain_name`, `CLOUDFLARE_API_TOKEN`, and AWS credentials used by the SES Terraform resources. Never put Stripe or SES application secret values in Terraform state.

## Transactional Email

The Worker uses Amazon SES v2 for draft confirmations and contact notifications. Set these as Worker secrets after SES sending is ready:

```sh
npx wrangler secret put SES_ACCESS_KEY_ID
npx wrangler secret put SES_SECRET_ACCESS_KEY
npx wrangler secret put SES_FROM_EMAIL
npx wrangler secret put SES_REGION
npx wrangler secret put SES_ADMIN_EMAIL
```

The IAM credentials need permission for `ses:SendEmail` against the Dear Paw SES identity. Email delivery is best effort; missing or failing SES configuration does not fail customer requests.

## Stripe Checkout

Checkout uses Stripe-hosted Checkout Sessions. Set the secret key and webhook signing secret as Worker secrets:

```sh
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Configure the Stripe webhook endpoint as `https://dearpaw.rip/api/stripe/webhook` and subscribe to `checkout.session.completed`, `checkout.session.expired`, and `checkout.session.async_payment_succeeded`.
Stripe Checkout enables automatic tax and collects a US shipping address for the physical memorial. Activate Stripe Tax, set the business origin, default tax behavior/product tax code, and add tax registrations in the Stripe Dashboard before accepting live payments. See [Stripe Tax for Checkout](https://docs.stripe.com/tax/checkout).

## AI/3D Generation Boundary

After confirmed payment, the app creates a `generation_jobs` record and sends a `generate_memorial` message to `dearpaw-jobs`. A companion Worker consumes the message. Until a provider is selected, it records `provider_not_configured` rather than attempting generation.

When a provider endpoint is ready, set these values on the `dearpaw-generation` Worker:

```sh
npx wrangler secret put GENERATION_API_URL --config wrangler.generation.jsonc
npx wrangler secret put GENERATION_API_TOKEN --config wrangler.generation.jsonc
```

The endpoint receives the job payload and must return JSON with an `outputManifest` value. Generated assets should be written to the private R2 bucket and referenced by keys in that manifest.
