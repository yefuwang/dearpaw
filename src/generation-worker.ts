interface GenerationEnv {
  DB: GenerationDatabase;
  GENERATION_API_URL?: string;
  GENERATION_API_TOKEN?: string;
}

interface GenerationDatabase {
  prepare(query: string): GenerationStatement;
}

interface GenerationStatement {
  bind(...values: unknown[]): GenerationStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}

interface QueueMessage<T> {
  body: T;
  ack(): void;
}

interface QueueBatch<T> {
  messages: QueueMessage<T>[];
}

interface GenerationMessage {
  type: "generate_memorial";
  jobId: string;
  orderId: string;
  input: { photos: Array<{ id: string; key: string; filename: string; mimeType: string }> };
}

function isGenerationMessage(value: unknown): value is GenerationMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<GenerationMessage>;
  return message.type === "generate_memorial" && typeof message.jobId === "string" && typeof message.orderId === "string" && Boolean(message.input);
}

async function processMessage(message: GenerationMessage, env: GenerationEnv) {
  const job = await env.DB.prepare("SELECT status FROM generation_jobs WHERE id = ? AND order_id = ?")
    .bind(message.jobId, message.orderId)
    .first<{ status: string }>();
  if (!job || job.status === "succeeded" || job.status === "running") return;

  await env.DB.prepare("UPDATE generation_jobs SET status = 'running', attempts = attempts + 1, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('queued', 'failed')")
    .bind(message.jobId)
    .run();

  if (!env.GENERATION_API_URL) {
    await env.DB.prepare("UPDATE generation_jobs SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind("provider_not_configured", message.jobId)
      .run();
    return;
  }

  let response: Response;
  try {
    response = await fetch(env.GENERATION_API_URL, {
      method: "POST",
      headers: {
        authorization: env.GENERATION_API_TOKEN ? `Bearer ${env.GENERATION_API_TOKEN}` : "",
        "content-type": "application/json",
      },
      body: JSON.stringify(message),
    });
  } catch {
    await env.DB.prepare("UPDATE generation_jobs SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind("generation_provider_unreachable", message.jobId)
      .run();
    return;
  }

  const body = (await response.json().catch(() => null)) as { outputManifest?: unknown; error?: string } | null;
  if (!response.ok || !body?.outputManifest) {
    await env.DB.prepare("UPDATE generation_jobs SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(body?.error?.slice(0, 500) ?? "generation_provider_failed", message.jobId)
      .run();
    return;
  }

  await env.DB.prepare("UPDATE generation_jobs SET status = 'succeeded', provider = ?, output_manifest = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(new URL(env.GENERATION_API_URL).hostname, JSON.stringify(body.outputManifest), message.jobId)
    .run();
}

export default {
  async fetch() {
    return new Response("Generation worker", { status: 200 });
  },
  async queue(batch: QueueBatch<unknown>, env: GenerationEnv) {
    for (const message of batch.messages) {
      if (!isGenerationMessage(message.body)) {
        message.ack();
        continue;
      }
      await processMessage(message.body, env);
      message.ack();
    }
  },
};
