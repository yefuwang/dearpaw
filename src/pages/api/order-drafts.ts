import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { productOptions } from "../../data/site";

export const prerender = false;

type OrderDraftInput = {
  customerName?: string;
  email?: string;
  petName?: string;
  species?: string;
  sizeId?: string;
  wood?: string;
};

const validSizeIds = new Set(productOptions.sizes.map((size) => size.id));
const validWoods = new Set(productOptions.woods);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const POST: APIRoute = async ({ request }) => {
  let input: OrderDraftInput;

  try {
    input = (await request.json()) as OrderDraftInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const customerName = clean(input.customerName);
  const email = clean(input.email).toLowerCase();
  const petName = clean(input.petName);
  const species = clean(input.species);
  const sizeId = clean(input.sizeId);
  const wood = clean(input.wood);

  if (!customerName || !email || !petName || !validSizeIds.has(sizeId) || !validWoods.has(wood)) {
    return Response.json({ error: "Missing or invalid order details." }, { status: 400 });
  }

  const selectedSize = productOptions.sizes.find((size) => size.id === sizeId);

  if (!selectedSize) {
    return Response.json({ error: "Invalid size." }, { status: 400 });
  }

  const customerId = crypto.randomUUID();
  const petId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const totalCents = selectedSize.price * 100;

  await env.DB.batch([
    env.DB.prepare("INSERT INTO customers (id, name, email) VALUES (?, ?, ?)").bind(customerId, customerName, email),
    env.DB.prepare("INSERT INTO pets (id, customer_id, name, species) VALUES (?, ?, ?, ?)").bind(
      petId,
      customerId,
      petName,
      species || null,
    ),
    env.DB.prepare(
      `INSERT INTO orders (
        id,
        customer_id,
        pet_id,
        status,
        payment_status,
        product_name,
        size_name,
        wood,
        subtotal_cents,
        total_cents
      ) VALUES (?, ?, ?, 'draft', 'not_started', ?, ?, ?, ?, ?)`,
    ).bind(
      orderId,
      customerId,
      petId,
      "The Portrait Urn",
      selectedSize.name,
      wood,
      totalCents,
      totalCents,
    ),
  ]);

  return Response.json(
    {
      orderId,
      status: "draft",
      nextStep: "photo_upload",
    },
    { status: 201 },
  );
};
