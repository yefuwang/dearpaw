import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const maxMediaBytes = 100 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);
const stages = new Set(["photos", "proof", "cnc", "painting", "finishing", "packing", "shipping", "general"]);
const uploadIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "production-media";
}

async function hasExpectedSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg") return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (file.type === "image/png") return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  if (file.type === "image/webp") return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
  if (file.type === "video/webm") return header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  if (file.type === "video/mp4" || file.type === "video/quicktime") return header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70;
  return false;
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
  const uploadId = clean(form.get("uploadId"));
  const stage = clean(form.get("stage"));
  const note = clean(form.get("note"));
  const visibility = clean(form.get("visibility")) || "customer";

  if (!uploadIdPattern.test(uploadId)) return Response.json({ error: "Missing or invalid upload id." }, { status: 400 });
  if (!(media instanceof File) || media.size <= 0 || media.size > maxMediaBytes || !allowedMimeTypes.has(media.type)) return Response.json({ error: "Media must be an image or video under 100 MB." }, { status: 400 });
  if (!(await hasExpectedSignature(media))) return Response.json({ error: "Media content does not match the declared file type." }, { status: 400 });
  if (!stages.has(stage) || !note || note.length > 1200 || !["customer", "internal"].includes(visibility)) return Response.json({ error: "Stage, note, and visibility are required." }, { status: 400 });

  const existingUpdate = await env.DB.prepare("SELECT id, media_type FROM production_updates WHERE id = ? AND order_id = ?")
    .bind(uploadId, orderId).first<{ id: string; media_type: string | null }>();
  if (existingUpdate) return Response.json({ updateId: existingUpdate.id, orderId, status: "uploaded", mediaType: existingUpdate.media_type }, { status: 200 });

  const updateId = uploadId;
  const filename = cleanFilename(media.name);
  const storageKey = `orders/${orderId}/production/${updateId}-${filename}`;
  await env.ASSETS_BUCKET.put(storageKey, media.stream(), { httpMetadata: { contentType: media.type }, customMetadata: { orderId, updateId, assetType: "production_media" } });

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO production_updates (id, order_id, stage, note, media_storage_key, media_type, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(updateId, orderId, stage, note, storageKey, media.type, visibility),
      env.DB.prepare("UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId),
    ]);
  } catch (error) {
    await env.ASSETS_BUCKET.delete(storageKey).catch(() => undefined);
    throw error;
  }

  return Response.json({ updateId, orderId, stage, visibility, filename, mediaType: media.type }, { status: 201 });
};
