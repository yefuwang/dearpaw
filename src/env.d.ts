/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  JOBS: Queue;
  TURNSTILE_SITEKEY: string;
  SES_ACCESS_KEY_ID?: string;
  SES_SECRET_ACCESS_KEY?: string;
  SES_FROM_EMAIL?: string;
  SES_REGION?: string;
  SES_ADMIN_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

declare module "cloudflare:workers" {
  export const env: Env;
}
