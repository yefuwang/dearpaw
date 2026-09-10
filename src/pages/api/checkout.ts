import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "JSON content type is required." }, { status: 415 });

  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!isRecord(input)) return Response.json({ error: "Invalid checkout details." }, { status: 400 });

  const orderId = clean(input.orderId);
  const email = clean(input.email).toLowerCase();
  if (!orderId || !email) return Response.json({ error: "Order reference and email are required." }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ error: "Checkout is not configured yet." }, { status: 503 });

  const order = await env.DB.prepare(
    `SELECT orders.id, orders.status, orders.total_cents, orders.product_name, orders.size_name, orders.wood,
            customers.email, pets.name AS pet_name, orders.stripe_checkout_session_id, orders.stripe_checkout_attempt
     FROM orders INNER JOIN customers ON customers.id = orders.customer_id
     INNER JOIN pets ON pets.id = orders.pet_id
     WHERE orders.id = ? AND lower(customers.email) = ? AND orders.status IN ('draft', 'awaiting_payment')`,
  ).bind(orderId, email).first<{ id: string; status: string; total_cents: number; product_name: string; size_name: string | null; wood: string | null; email: string; pet_name: string }>();

  if (!order) return Response.json({ error: "No payable order found for that reference and email." }, { status: 404 });

  const stripeHeaders = {
    authorization: `Basic ${btoa(`${env.STRIPE_SECRET_KEY}:`)}`,
    "content-type": "application/x-www-form-urlencoded",
    "idempotency-key": `checkout-${order.id}-${order.stripe_checkout_attempt}`,
  };

  if (order.stripe_checkout_session_id) {
    try {
      const existingResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.stripe_checkout_session_id)}`, { headers: stripeHeaders });
      const existing = (await existingResponse.json().catch(() => null)) as { status?: string; url?: string } | null;
      if (existingResponse.ok && existing?.status === "open" && existing.url) {
        return Response.json({ sessionId: order.stripe_checkout_session_id, url: existing.url, status: "awaiting_payment" });
      }
    } catch {
      return Response.json({ error: "Checkout could not be reached. Please try again." }, { status: 502 });
    }
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `https://dearpaw.rip/track?orderId=${encodeURIComponent(order.id)}&checkout=success`);
  params.set("cancel_url", `https://dearpaw.rip/track?orderId=${encodeURIComponent(order.id)}&checkout=cancelled`);
  params.set("customer_email", order.email);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(order.total_cents));
  params.set("line_items[0][price_data][product_data][name]", `${order.product_name} for ${order.pet_name}`);
  params.set("line_items[0][price_data][product_data][description]", `${order.size_name ?? "Custom size"} in ${order.wood ?? "selected wood"}`);
  params.set("metadata[order_id]", order.id);
  params.set("payment_intent_data[metadata][order_id]", order.id);

  let stripeResponse: Response;
  try {
    stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: stripeHeaders, body: params });
  } catch {
    return Response.json({ error: "Checkout could not be reached. Please try again." }, { status: 502 });
  }
  const session = (await stripeResponse.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null;

  if (!stripeResponse.ok || !session?.url) return Response.json({ error: session?.error?.message ?? "Checkout could not be started." }, { status: 502 });

  await env.DB.prepare("UPDATE orders SET status = 'awaiting_payment', payment_status = 'pending', stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id, order.id).run();
  return Response.json({ sessionId: session.id, url: session.url, status: "awaiting_payment" });
};
