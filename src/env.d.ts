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
}

