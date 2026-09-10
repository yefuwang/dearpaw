import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const maxMediaBytes = 100 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "production-media";
}

export const POST: APIRoute = async ({ params, request }) => {
  const orderId = params.orderId?.trim();
  const contentType = request.headers.get("content-type") ?? "";

  if (!orderId) return Response.json({ error: "Missing order id." }, { status: 400 });
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) return Response.json({ error: "Multipart form data is required." }, { status: 415 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });

  const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(orderId).first<{ id: string }>();
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > maxMediaBytes + 1024 * 1024) return Response.json({ error: "Production media is too large." }, { status: 413 });

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Invalid multipart form data." }, { status: 400 }); }

  const media = form.get("media");
  const stage = clean(form.get("stage"));
  const note = clean(form.get("note"));
  const visibility = clean(form.get("visibility")) || "customer";

  if (!(media instanceof File) || media.size <= 0 || media.size > maxMediaBytes || !allowedMimeTypes.has(media.type)) return Response.json({ error: "Media must be an image or video under 100 MB." }, { status: 400 });
  if (!stage || !note || note.length > 1200 || !["customer", "internal"].includes(visibility)) return Response.json({ error: "Stage, note, and visibility are required." }, { status: 400 });

  const updateId = crypto.randomUUID();
  const filename = cleanFilename(media.name);
  const storageKey = `orders/${orderId}/production/${updateId}-${filename}`;
  await env.ASSETS_BUCKET.put(storageKey, media.stream(), { httpMetadata: { contentType: media.type }, customMetadata: { orderId, updateId, assetType: "production_media" } });

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO production_updates (id, order_id, stage, note, media_storage_key, media_type, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(updateId, orderId, stage, note, storageKey, media.type, visibility),
      env.DB.prepare("UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId),
    ]);
  } catch (error) {
    await env.ASSETS_BUCKET.delete(storageKey);
    throw error;
  }

  return Response.json({ updateId, orderId, stage, visibility, filename, mediaType: media.type }, { status: 201 });
};
