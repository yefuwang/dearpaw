import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const updateId = params.updateId?.trim();
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!updateId || !token) return new Response("Not found", { status: 404 });

  const update = await env.DB.prepare(
    `SELECT production_updates.media_storage_key
     FROM production_updates INNER JOIN orders ON orders.id = production_updates.order_id
     WHERE production_updates.id = ? AND production_updates.visibility = 'customer' AND orders.tracking_token = ?`,
  ).bind(updateId, token).first<{ media_storage_key: string | null }>();
  if (!update?.media_storage_key) return new Response("Not found", { status: 404 });

  const object = await env.ASSETS_BUCKET.get(update.media_storage_key);
  if (!object?.body) return new Response("Media unavailable", { status: 404 });
  return new Response(object.body, { headers: { "cache-control": "private, no-store", "content-type": object.httpMetadata?.contentType ?? "application/octet-stream", etag: object.httpEtag } });
};
