import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sendEmailBestEffort } from "../../lib/email";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return new Response("Missing required fields.", { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO contact_requests (id, name, email, message, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      name,
      email.toLowerCase(),
      message,
      request.headers.get("user-agent"),
      request.headers.get("cf-connecting-ip"),
    )
    .run();

  if (env.SES_ADMIN_EMAIL) {
    await sendEmailBestEffort({
      to: env.SES_ADMIN_EMAIL,
      subject: `Dear Paw contact request from ${name}`,
      text: `From: ${name} <${email.toLowerCase()}>\n\n${message}`,
    });
  }

  return new Response("Thanks. We received your message.", { status: 202 });
};
