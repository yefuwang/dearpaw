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
  created_at: string;
};

type OrderStatusInput = {
  orderId?: string;
  email?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const POST: APIRoute = async ({ request }) => {
  let input: OrderStatusInput;

  try {
    input = (await request.json()) as OrderStatusInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
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
      pets.species
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
      `SELECT id, stage, note, media_type, created_at
       FROM production_updates
       WHERE order_id = ? AND visibility = 'customer'
       ORDER BY created_at DESC
       LIMIT 20`,
    )
      .bind(order.id)
      .all<ProductionUpdateRow>(),
  ]);

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
    },
    uploads: uploads.results,
    proofs: proofs.results,
    updates: updates.results,
  });
};
