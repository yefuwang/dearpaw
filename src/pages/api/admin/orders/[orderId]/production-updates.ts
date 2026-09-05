import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const stages = new Set(["photos", "proof", "cnc", "painting", "finishing", "packing", "shipping", "general"]);
const visibilities = new Set(["customer", "internal"]);

type ProductionUpdateInput = {
  stage?: string;
  note?: string;
  visibility?: string;
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

  let input: ProductionUpdateInput;

  try {
    input = (await request.json()) as ProductionUpdateInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const stage = clean(input.stage);
  const note = clean(input.note);
  const visibility = clean(input.visibility) || "customer";

  if (!stages.has(stage) || !visibilities.has(visibility) || !note || note.length > 1200) {
    return Response.json({ error: "Stage, visibility, and note are required." }, { status: 400 });
  }

  const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(orderId).first<{ id: string }>();

  if (!order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  const updateId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare("INSERT INTO production_updates (id, order_id, stage, note, visibility) VALUES (?, ?, ?, ?, ?)").bind(
      updateId,
      orderId,
      stage,
      note,
      visibility,
    ),
    env.DB.prepare("UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId),
  ]);

  return Response.json(
    { updateId, orderId, stage, visibility },
    {
      status: 201,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
};
