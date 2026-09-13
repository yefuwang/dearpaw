import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const orderStatuses = new Set(["draft", "photos_received", "proofing", "approved", "production", "shipped", "completed", "canceled"]);

type OrderRow = {
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
  customer_email: string;
  pet_name: string;
  species: string | null;
  upload_count: number;
  proof_count: number;
  update_count: number;
};

type ContactRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

type ProductionUpdateRow = {
  id: string;
  order_id: string;
  stage: string;
  note: string;
  visibility: string;
  media_type: string | null;
  created_at: string;
};

function cleanStatus(value: string | null) {
  const status = (value ?? "").trim();
  return orderStatuses.has(status) ? status : "";
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const statusFilter = cleanStatus(url.searchParams.get("status"));

  const ordersQuery = statusFilter
    ? `SELECT
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
        customers.email AS customer_email,
        pets.name AS pet_name,
        pets.species,
        COUNT(DISTINCT uploads.id) AS upload_count,
        COUNT(DISTINCT proofs.id) AS proof_count,
        COUNT(DISTINCT production_updates.id) AS update_count
      FROM orders
      INNER JOIN customers ON customers.id = orders.customer_id
      INNER JOIN pets ON pets.id = orders.pet_id
      LEFT JOIN uploads ON uploads.order_id = orders.id
      LEFT JOIN proofs ON proofs.order_id = orders.id
      LEFT JOIN production_updates ON production_updates.order_id = orders.id
      WHERE orders.status = ?
      GROUP BY orders.id
      ORDER BY orders.created_at DESC
      LIMIT 50`
    : `SELECT
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
        customers.email AS customer_email,
        pets.name AS pet_name,
        pets.species,
        COUNT(DISTINCT uploads.id) AS upload_count,
        COUNT(DISTINCT proofs.id) AS proof_count,
        COUNT(DISTINCT production_updates.id) AS update_count
      FROM orders
      INNER JOIN customers ON customers.id = orders.customer_id
      INNER JOIN pets ON pets.id = orders.pet_id
      LEFT JOIN uploads ON uploads.order_id = orders.id
      LEFT JOIN proofs ON proofs.order_id = orders.id
      LEFT JOIN production_updates ON production_updates.order_id = orders.id
      GROUP BY orders.id
      ORDER BY orders.created_at DESC
      LIMIT 50`;

  const [orders, contacts, updates] = await Promise.all([
    statusFilter
      ? env.DB.prepare(ordersQuery).bind(statusFilter).all<OrderRow>()
      : env.DB.prepare(ordersQuery).all<OrderRow>(),
    env.DB.prepare(
      `SELECT id, name, email, message, status, created_at
       FROM contact_requests
       ORDER BY created_at DESC
       LIMIT 25`,
    ).all<ContactRow>(),
    env.DB.prepare(
      `SELECT id, order_id, stage, note, visibility, media_type, created_at
       FROM production_updates
       ORDER BY created_at DESC
       LIMIT 25`,
    ).all<ProductionUpdateRow>(),
  ]);

  return Response.json(
    {
      statuses: Array.from(orderStatuses),
      orders: orders.results,
      contacts: contacts.results,
      updates: updates.results,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
};
