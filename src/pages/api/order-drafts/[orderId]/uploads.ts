import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const maxUploadBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const contentLengthSlackBytes = 1024 * 1024;

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "pet-photo";
}

async function hasExpectedSignature(photo: File) {
  const header = new Uint8Array(await photo.slice(0, 16).arrayBuffer());

  if (photo.type === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }

  if (photo.type === "image/png") {
    return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  }

  if (photo.type === "image/webp") {
    return (
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    );
  }

  if (photo.type === "image/heic" || photo.type === "image/heif") {
    return header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70;
  }

  return false;
}

export const POST: APIRoute = async ({ params, request }) => {
  const orderId = params.orderId?.trim();

  if (!orderId) {
    return Response.json({ error: "Missing order id." }, { status: 400 });
  }

  const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND status = 'draft'")
    .bind(orderId)
    .first<{ id: string }>();

  if (!order) {
    return Response.json({ error: "Order draft not found." }, { status: 404 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxUploadBytes + contentLengthSlackBytes) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const photo = form.get("photo");

  if (!(photo instanceof File)) {
    return Response.json({ error: "Missing photo file." }, { status: 400 });
  }

  if (photo.size <= 0 || photo.size > maxUploadBytes) {
    return Response.json({ error: "Photo must be between 1 byte and 10 MB." }, { status: 400 });
  }

  if (!allowedMimeTypes.has(photo.type)) {
    return Response.json({ error: "Photo must be JPEG, PNG, WEBP, HEIC, or HEIF." }, { status: 400 });
  }

  if (!(await hasExpectedSignature(photo))) {
    return Response.json({ error: "Photo content does not match the declared image type." }, { status: 400 });
  }

  const uploadId = crypto.randomUUID();
  const filename = cleanFilename(photo.name);
  const storageKey = `orders/${orderId}/uploads/${uploadId}-${filename}`;

  await env.ASSETS_BUCKET.put(storageKey, photo.stream(), {
    httpMetadata: {
      contentType: photo.type,
    },
    customMetadata: {
      orderId,
      uploadId,
      originalFilename: filename,
      assetType: "pet_photo",
    },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO uploads (id, order_id, asset_type, storage_key, filename, mime_type, byte_size)
       VALUES (?, ?, 'pet_photo', ?, ?, ?, ?)`,
    )
      .bind(uploadId, orderId, storageKey, filename, photo.type, photo.size)
      .run();
  } catch (error) {
    await env.ASSETS_BUCKET.delete(storageKey);
    throw error;
  }

  return Response.json(
    {
      uploadId,
      filename,
      status: "uploaded",
    },
    { status: 201 },
  );
};
