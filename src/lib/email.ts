import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "cloudflare:workers";
import { logEvent } from "./observability";

type EmailInput = {
  to: string;
  subject: string;
  text: string;
  requestId?: string;
};

export async function sendEmail(input: EmailInput) {
  const { SES_ACCESS_KEY_ID: accessKeyId, SES_SECRET_ACCESS_KEY: secretAccessKey, SES_FROM_EMAIL: fromEmail, SES_REPLY_TO_EMAIL: replyToEmail, SES_REGION: region } = env;

  if (!accessKeyId || !secretAccessKey || !fromEmail || !region) {
    return false;
  }

  const client = new SESv2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await client.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      ReplyToAddresses: replyToEmail ? [replyToEmail] : undefined,
      Destination: { ToAddresses: [input.to] },
      Content: { Simple: { Subject: { Data: input.subject }, Body: { Text: { Data: input.text } } } },
    }),
  );

  return true;
}

export async function sendEmailBestEffort(input: EmailInput) {
  try {
    const sent = await sendEmail(input);
    if (!sent) {
      logEvent("email_send_skipped", {
        requestId: input.requestId,
        to: input.to,
        subject: input.subject,
        reason: "missing_configuration",
      });
      return;
    }

    logEvent("email_sent", {
      requestId: input.requestId,
      to: input.to,
      subject: input.subject,
    });
  } catch (error) {
    logEvent("email_send_failed", {
      requestId: input.requestId,
      to: input.to,
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown SES error",
    });
    // Email delivery must not fail the underlying customer or admin action.
  }
}
