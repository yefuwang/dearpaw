import { env } from "cloudflare:workers";
import { AwsClient } from "aws4fetch";
import { logEvent } from "./observability";

type EmailInput = {
  to: string;
  subject: string;
  text: string;
  requestId?: string;
  orderId?: string;
};

async function readErrorPreview(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return response.statusText;

  const maxBytes = 500;
  let bytes = new Uint8Array(0);
  try {
    while (bytes.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;

      const remaining = maxBytes - bytes.length;
      const next = new Uint8Array(bytes.length + Math.min(value.length, remaining));
      next.set(bytes);
      next.set(value.subarray(0, remaining), bytes.length);
      bytes = next;

      if (value.length >= remaining) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return new TextDecoder().decode(bytes) || response.statusText;
}

export async function sendEmail(input: EmailInput) {
  const { SES_ACCESS_KEY_ID: accessKeyId, SES_SECRET_ACCESS_KEY: secretAccessKey, SES_FROM_EMAIL: fromEmail, SES_REPLY_TO_EMAIL: replyToEmail, SES_REGION: region } = env;

  if (!accessKeyId || !secretAccessKey || !fromEmail || !region) {
    return false;
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "ses",
    region,
    // SES submission is not idempotent: an ambiguous network failure could
    // otherwise result in a duplicate message after SES accepted the request.
    retries: 0,
  });
  const response = await client.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: fromEmail,
      ReplyToAddresses: replyToEmail ? [replyToEmail] : undefined,
      Destination: { ToAddresses: [input.to] },
      Content: { Simple: { Subject: { Data: input.subject }, Body: { Text: { Data: input.text } } } },
    }),
  });

  if (!response.ok) {
    const details = await readErrorPreview(response);
    throw new Error(`SES ${response.status}: ${details || response.statusText}`);
  }

  return true;
}

export async function sendEmailBestEffort(input: EmailInput) {
  try {
    const sent = await sendEmail(input);
    if (!sent) {
      logEvent("email_send_skipped", {
        requestId: input.requestId,
        orderId: input.orderId,
        to: input.to,
        subject: input.subject,
        reason: "missing_configuration",
      });
      return;
    }

    logEvent("email_sent", {
      requestId: input.requestId,
      orderId: input.orderId,
      to: input.to,
      subject: input.subject,
    });
  } catch (error) {
    logEvent("email_send_failed", {
      requestId: input.requestId,
      orderId: input.orderId,
      to: input.to,
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown SES error",
    });
    // Email delivery must not fail the underlying customer or admin action.
  }
}
