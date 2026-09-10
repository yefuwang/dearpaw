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
  const values = new Map(header.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = Number(values.get("t"));
  const signature = values.get("v1");
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const received = new Uint8Array(signature.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  return equalBytes(expected, received);
}

export const POST: APIRoute = async ({ request }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook not configured", { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!(await validSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET))) return new Response("Invalid signature", { status: 400 });

  let event: { type?: string; data?: { object?: { metadata?: { order_id?: string }; payment_status?: string } } };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const orderId = event.data?.object?.metadata?.order_id;
  if (orderId && event.type === "checkout.session.completed") {
    await env.DB.prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND payment_status != 'paid'").bind(orderId).run();
  }
  if (orderId && event.type === "checkout.session.expired") {
    await env.DB.prepare("UPDATE orders SET status = 'draft', payment_status = 'not_started', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND payment_status != 'paid'").bind(orderId).run();
  }
  return new Response("ok", { status: 200 });
};
