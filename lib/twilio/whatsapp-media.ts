// Download a Twilio media URL (the MediaUrlN values posted by the inbound
// WhatsApp webhook). These URLs return a 302 redirect to S3 and require HTTP
// Basic auth using the Twilio account credentials.

export interface DownloadedMedia {
  buffer: Buffer;
  contentType: string;
}

export async function downloadTwilioMedia(url: string): Promise<DownloadedMedia> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials missing");

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Twilio media download failed: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}
