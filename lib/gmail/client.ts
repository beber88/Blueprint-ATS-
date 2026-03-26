import { google } from "googleapis";

function getGmailClient() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    throw new Error("Gmail is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<string | null> {
  const gmail = getGmailClient();

  if (!process.env.GMAIL_SENDER_EMAIL) {
    throw new Error("GMAIL_SENDER_EMAIL is not configured.");
  }

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    `From: ${process.env.GMAIL_SENDER_EMAIL}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    body.replace(/\n/g, "<br>"),
  ];
  const message = messageParts.join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return res.data.id || null;
}
