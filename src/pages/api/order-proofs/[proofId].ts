import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const proofId = params.proofId?.trim();
  const token = new URL(request.url).searchParams.get("token")?.trim();

  if (!proofId || !token) {
    return new Response("Not found", { status: 404 });
  }

  const proof = await env.DB.prepare(
    `SELECT proofs.storage_key, proofs.status
     FROM proofs INNER JOIN orders ON orders.id = proofs.order_id
     WHERE proofs.id = ? AND orders.tracking_token = ?`,
  )
    .bind(proofId, token)
    .first<{ storage_key: string; status: string }>();

  if (!proof) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.ASSETS_BUCKET.get(proof.storage_key);

  if (!object?.body) {
    return new Response("Proof unavailable", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      etag: object.httpEtag,
    },
  });
};
