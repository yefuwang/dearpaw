import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

type OrderStatusRow = {
  id: string;
  status: string;
  payment_status: string;
  product_name: string;
  size_name: string | null;
  wood: string | null;
  total_cents: number;
  created_at: string;
  updated_at: string;
  customer_name: string;
  pet_name: string;
  species: string | null;
  birth_text: string | null;
  passing_text: string | null;
  inscription: string | null;
  tracking_token: string | null;
};

type UploadRow = {
  id: string;
  filename: string;
  asset_type: string;
  created_at: string;
};

type ProofRow = {
  id: string;
  version: number;
  status: string;
  created_at: string;
};

type ProductionUpdateRow = {
  id: string;
  stage: string;
  note: string;
  media_type: string | null;
  media_storage_key: string | null;
  created_at: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const POST: APIRoute = async ({ request }) => {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!isRecord(input)) {
    return Response.json({ error: "Invalid order details." }, { status: 400 });
  }

  const orderId = clean(input.orderId);
  const email = clean(input.email).toLowerCase();

  if (!orderId || !email || orderId.length > 100 || email.length > 320) {
    return Response.json({ error: "Order reference and email are required." }, { status: 400 });
  }

  const order = await env.DB.prepare(
    `SELECT
      orders.id,
      orders.status,
      orders.payment_status,
      orders.product_name,
      orders.size_name,
      orders.wood,
      orders.total_cents,
      orders.created_at,
      orders.updated_at,
      customers.name AS customer_name,
      pets.name AS pet_name,
      pets.species,
      pets.birth_text,
      pets.passing_text,
      orders.inscription,
      orders.tracking_token
    FROM orders
    INNER JOIN customers ON customers.id = orders.customer_id
    INNER JOIN pets ON pets.id = orders.pet_id
    WHERE orders.id = ? AND lower(customers.email) = ?`,
  )
    .bind(orderId, email)
    .first<OrderStatusRow>();

  if (!order) {
    return Response.json({ error: "No order found for that reference and email." }, { status: 404 });
  }

  const [uploads, proofs, updates] = await Promise.all([
    env.DB.prepare(
      `SELECT id, filename, asset_type, created_at
       FROM uploads
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
      .bind(order.id)
      .all<UploadRow>(),
    env.DB.prepare(
      `SELECT id, version, status, created_at
       FROM proofs
       WHERE order_id = ?
       ORDER BY version DESC
       LIMIT 20`,
    )
      .bind(order.id)
      .all<ProofRow>(),
    env.DB.prepare(
      `SELECT id, stage, note, media_type, media_storage_key, created_at
       FROM production_updates
       WHERE order_id = ? AND visibility = 'customer'
       ORDER BY created_at DESC
       LIMIT 20`,
    )
      .bind(order.id)
      .all<ProductionUpdateRow>(),
  ]);
  const generation = await env.DB.prepare(
    "SELECT status, provider, created_at, updated_at FROM generation_jobs WHERE order_id = ?",
  ).bind(order.id).first<{ status: string; provider: string | null; created_at: string; updated_at: string }>();

  return Response.json({
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      productName: order.product_name,
      sizeName: order.size_name,
      wood: order.wood,
      totalCents: order.total_cents,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
    customer: {
      name: order.customer_name,
    },
    pet: {
      name: order.pet_name,
      species: order.species,
      birthYear: order.birth_text,
      passingYear: order.passing_text,
      inscription: order.inscription,
    },
    uploads: uploads.results,
    proofs: proofs.results.map((proof: ProofRow) => ({
      ...proof,
      accessUrl: order.tracking_token ? `/api/order-proofs/${encodeURIComponent(proof.id)}?token=${encodeURIComponent(order.tracking_token)}` : null,
    })),
    updates: updates.results.map((update: ProductionUpdateRow) => ({
      id: update.id,
      stage: update.stage,
      note: update.note,
      media_type: update.media_type,
      created_at: update.created_at,
      mediaUrl: order.tracking_token && update.media_storage_key
        ? `/api/order-media/${encodeURIComponent(update.id)}?token=${encodeURIComponent(order.tracking_token)}`
        : null,
    })),
    generation: generation
      ? { status: generation.status, provider: generation.provider, createdAt: generation.created_at, updatedAt: generation.updated_at }
      : null,
    proofAccessToken: order.tracking_token,
  }, { headers: { "cache-control": "no-store" } });
};
