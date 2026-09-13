import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const orderStatuses = new Set(["draft", "photos_received", "proofing", "approved", "production", "shipped", "completed", "canceled"]);

type StatusInput = {
  status?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const POST: APIRoute = async ({ params, request }) => {
  const orderId = params.orderId?.trim();

  if (!orderId) {
    return Response.json({ error: "Missing order id." }, { status: 400 });
  }

  if (request.headers.get("content-type") !== "application/json") {
    return Response.json({ error: "JSON content type is required." }, { status: 415 });
  }

  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let input: StatusInput;

  try {
    input = (await request.json()) as StatusInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const status = clean(input.status);

  if (!orderStatuses.has(status)) {
    return Response.json({ error: "Invalid order status." }, { status: 400 });
  }

  const result = await env.DB.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, orderId)
    .run();

  if (!result.meta.changes) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  return Response.json(
    { orderId, status },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
};
