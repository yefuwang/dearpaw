import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const actions = new Set(["approve", "request_revision"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const POST: APIRoute = async ({ params, request }) => {
  const proofId = params.proofId?.trim();
  const origin = request.headers.get("origin");

  if (!proofId || (origin && origin !== new URL(request.url).origin)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "JSON content type is required." }, { status: 415 });
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!isRecord(input)) {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const token = clean(input.token);
  const action = clean(input.action);
  const notes = clean(input.notes);

  if (!token || !actions.has(action) || notes.length > 1200) {
    return Response.json({ error: "A valid decision is required." }, { status: 400 });
  }

  const proof = await env.DB.prepare(
    `SELECT proofs.id, proofs.order_id
     FROM proofs INNER JOIN orders ON orders.id = proofs.order_id
     WHERE proofs.id = ? AND orders.tracking_token = ?`,
  )
    .bind(proofId, token)
    .first<{ id: string; order_id: string }>();

  if (!proof) {
    return Response.json({ error: "Proof not found." }, { status: 404 });
  }

  const proofStatus = action === "approve" ? "approved" : "revision_requested";
  const orderStatus = action === "approve" ? "approved" : "proofing";

  await env.DB.batch([
    env.DB.prepare("UPDATE proofs SET status = ?, customer_notes = ? WHERE id = ?").bind(proofStatus, notes || null, proofId),
    env.DB.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderStatus, proof.order_id),
  ]);

  return Response.json({ proofId, status: proofStatus, orderStatus });
};
