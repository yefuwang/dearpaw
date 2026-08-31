import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return new Response("Missing required fields.", { status: 400 });
  }

  // TODO(APP): Persist contact requests and send SES email once the database schema is applied.
  return new Response("Thanks. We received your message.", { status: 202 });
};

