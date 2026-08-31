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
