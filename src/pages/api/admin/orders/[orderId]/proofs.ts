import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const maxProofBytes = 20 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const signatureBytes: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
};

async function hasExpectedSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const signature = signatureBytes[file.type];
  return signature.every((byte, index) => byte === 0 || header[index] === byte);
}

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "proof";
}

export const POST: APIRoute = async ({ params, request }) => {
  const orderId = params.orderId?.trim();

  if (!orderId) {
    return Response.json({ error: "Missing order id." }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return Response.json({ error: "Multipart form data is required." }, { status: 415 });
  }

  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(orderId).first<{ id: string }>();

  if (!order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxProofBytes + 1024 * 1024) {
    return Response.json({ error: "Proof file is too large." }, { status: 413 });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const proof = form.get("proof");

  if (!(proof instanceof File) || proof.size <= 0 || proof.size > maxProofBytes) {
    return Response.json({ error: "Proof must be between 1 byte and 20 MB." }, { status: 400 });
  }

  if (!allowedMimeTypes.has(proof.type)) {
    return Response.json({ error: "Proof must be a PDF, JPEG, PNG, or WEBP file." }, { status: 400 });
  }

  if (!(await hasExpectedSignature(proof))) {
    return Response.json({ error: "Proof content does not match the declared file type." }, { status: 400 });
  }

  const latest = await env.DB.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM proofs WHERE order_id = ?")
    .bind(orderId)
    .first<{ version: number }>();
  const version = (latest?.version ?? 0) + 1;
  const proofId = crypto.randomUUID();
  const filename = cleanFilename(proof.name);
  const storageKey = `orders/${orderId}/proofs/${proofId}-${filename}`;

  await env.ASSETS_BUCKET.put(storageKey, proof.stream(), {
    httpMetadata: { contentType: proof.type },
    customMetadata: { orderId, proofId, version: String(version), assetType: "proof" },
  });

  try {
    await env.DB.batch([
      env.DB.prepare(
      `INSERT INTO proofs (id, order_id, version, storage_key, status)
       VALUES (?, ?, ?, ?, 'proof_ready')`,
      ).bind(proofId, orderId, version, storageKey),
      env.DB.prepare("UPDATE orders SET status = 'proofing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId),
    ]);
  } catch (error) {
    await env.ASSETS_BUCKET.delete(storageKey);
    if (String(error).toLowerCase().includes("unique")) {
      return Response.json({ error: "Another proof was uploaded. Please try again." }, { status: 409 });
    }
    throw error;
  }

  return Response.json({ proofId, orderId, version, filename, status: "proof_ready" }, { status: 201 });
};
