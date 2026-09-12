import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

async function validSignature(payload: string, header: string, secret: string) {
  const values = header.split(",").reduce((result, part) => {
    const [key, value] = part.split("=", 2);
    if (key && value) result[key] ??= [];
    if (key && value) result[key].push(value);
    return result;
  }, {} as Record<string, string[]>);
  const timestamp = Number(values.t?.[0]);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return (values.v1 ?? []).some((signature) => {
    const received = new Uint8Array(signature.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
    return equalBytes(expected, received);
  });
}

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: { id?: string; metadata?: { order_id?: string }; payment_status?: string } };
};

async function orderPaymentStatus(orderId: string) {
  return env.DB.prepare("SELECT payment_status, stripe_checkout_session_id FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ payment_status: string; stripe_checkout_session_id: string | null }>();
}

async function queueGeneration(orderId: string) {
  const existingJob = await env.DB.prepare("SELECT id, enqueued_at FROM generation_jobs WHERE order_id = ?")
    .bind(orderId)
    .first<{ id: string; enqueued_at: string | null }>();
  if (existingJob?.enqueued_at) return;

  const uploads = await env.DB.prepare(
    "SELECT id, storage_key, filename, mime_type FROM uploads WHERE order_id = ? ORDER BY created_at ASC LIMIT 20",
  ).bind(orderId).all<{ id: string; storage_key: string; filename: string; mime_type: string }>();
  if (uploads.results.length < 3) throw new Error("Generation requires at least 3 uploaded photos.");

  const inputManifest = JSON.stringify({
    photos: uploads.results.map((upload: { id: string; storage_key: string; filename: string; mime_type: string }) => ({
      id: upload.id,
      key: upload.storage_key,
      filename: upload.filename,
      mimeType: upload.mime_type,
    })),
  });
  const jobId = existingJob?.id ?? crypto.randomUUID();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO generation_jobs (id, order_id, status, input_manifest) VALUES (?, ?, 'queued', ?)",
  ).bind(jobId, orderId, inputManifest).run();
  await env.JOBS.send({ type: "generate_memorial", jobId, orderId, input: JSON.parse(inputManifest) });
  await env.DB.prepare("UPDATE generation_jobs SET enqueued_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(jobId)
    .run();
}

export const POST: APIRoute = async ({ request }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook not configured", { status: 503 });
  const payload = await request.text();
  if (!(await validSignature(payload, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET))) return new Response("Invalid signature", { status: 400 });

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!event.id || !event.type) return new Response("Invalid event", { status: 400 });
  if (await env.DB.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(event.id).first()) return new Response("ok", { status: 200 });

  const session = event.data?.object;
  const orderId = session?.metadata?.order_id;
  const sessionId = session?.id;
  if (orderId && sessionId && event.type === "checkout.session.completed" && session.payment_status === "paid") {
    const result = await env.DB.prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stripe_checkout_session_id = ? AND payment_status != 'paid'").bind(orderId, sessionId).run();
    const order = result.meta.changes === 0 ? await orderPaymentStatus(orderId) : null;
    if (order && order.stripe_checkout_session_id !== sessionId) return new Response("ok", { status: 200 });
    if (result.meta.changes === 0 && order?.payment_status !== "paid") return new Response("Order is not ready for this payment event", { status: 500 });
    await queueGeneration(orderId);
  } else if (orderId && sessionId && event.type === "checkout.session.async_payment_succeeded") {
    const result = await env.DB.prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stripe_checkout_session_id = ? AND payment_status != 'paid'").bind(orderId, sessionId).run();
    const order = result.meta.changes === 0 ? await orderPaymentStatus(orderId) : null;
    if (order && order.stripe_checkout_session_id !== sessionId) return new Response("ok", { status: 200 });
    if (result.meta.changes === 0 && order?.payment_status !== "paid") return new Response("Order is not ready for this payment event", { status: 500 });
    await queueGeneration(orderId);
  } else if (orderId && sessionId && event.type === "checkout.session.expired") {
    const result = await env.DB.prepare("UPDATE orders SET status = 'draft', payment_status = 'not_started', stripe_checkout_session_id = NULL, stripe_checkout_attempt = stripe_checkout_attempt + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stripe_checkout_session_id = ? AND payment_status != 'paid'").bind(orderId, sessionId).run();
    if (result.meta.changes === 0) {
      const matchingOrder = await orderPaymentStatus(orderId);
      if (!matchingOrder) return new Response("Order is not ready for this expiration event", { status: 500 });
      if (matchingOrder.stripe_checkout_session_id !== sessionId) return new Response("ok", { status: 200 });
    }
  }

  await env.DB.prepare("INSERT INTO stripe_events (id, event_type) VALUES (?, ?)").bind(event.id, event.type).run();
  return new Response("ok", { status: 200 });
};
