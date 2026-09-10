import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { productOptions } from "../../data/site";

export const prerender = false;

const validSizeIds = new Set(productOptions.sizes.map((size) => size.id));
const validWoods = new Set(productOptions.woods);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const yearPattern = /^\d{4}$/;

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

  const optionalFields = ["birthYear", "passingYear", "inscription"];

  if (optionalFields.some((field) => input[field] !== undefined && typeof input[field] !== "string")) {
    return Response.json({ error: "Invalid personalization details." }, { status: 400 });
  }

  const customerName = clean(input.customerName);
  const email = clean(input.email).toLowerCase();
  const petName = clean(input.petName);
  const species = clean(input.species);
  const birthYear = clean(input.birthYear);
  const passingYear = clean(input.passingYear);
  const inscription = clean(input.inscription);
  const sizeId = clean(input.sizeId);
  const wood = clean(input.wood);

  if (
    !customerName ||
    !email ||
    !petName ||
    !validSizeIds.has(sizeId) ||
    !validWoods.has(wood) ||
    (birthYear && !yearPattern.test(birthYear)) ||
    (passingYear && !yearPattern.test(passingYear)) ||
    inscription.length > 160
  ) {
    return Response.json({ error: "Missing or invalid order details." }, { status: 400 });
  }

  if (!emailPattern.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const selectedSize = productOptions.sizes.find((size) => size.id === sizeId);

  if (!selectedSize) {
    return Response.json({ error: "Invalid size." }, { status: 400 });
  }

  const customerId = crypto.randomUUID();
  const petId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const trackingToken = crypto.randomUUID();
  const totalCents = selectedSize.price * 100;

  await env.DB.batch([
    env.DB.prepare("INSERT INTO customers (id, name, email) VALUES (?, ?, ?)").bind(customerId, customerName, email),
    env.DB.prepare("INSERT INTO pets (id, customer_id, name, species, birth_text, passing_text) VALUES (?, ?, ?, ?, ?, ?)").bind(
      petId,
      customerId,
      petName,
      species || null,
      birthYear || null,
      passingYear || null,
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
        total_cents,
        inscription,
        tracking_token
      ) VALUES (?, ?, ?, 'draft', 'not_started', ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      orderId,
      customerId,
      petId,
      "The Portrait Urn",
      selectedSize.name,
      wood,
      totalCents,
      totalCents,
      inscription || null,
      trackingToken,
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
