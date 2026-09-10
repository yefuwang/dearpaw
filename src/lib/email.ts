import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "cloudflare:workers";

type EmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(input: EmailInput) {
  const { SES_ACCESS_KEY_ID: accessKeyId, SES_SECRET_ACCESS_KEY: secretAccessKey, SES_FROM_EMAIL: fromEmail, SES_REGION: region } = env;

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
      Destination: { ToAddresses: [input.to] },
      Content: { Simple: { Subject: { Data: input.subject }, Body: { Text: { Data: input.text } } } },
    }),
  );

  return true;
}

export async function sendEmailBestEffort(input: EmailInput) {
  try {
    await sendEmail(input);
  } catch {
    // Email delivery must not fail the underlying customer or admin action.
  }
}
