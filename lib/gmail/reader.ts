import { google, gmail_v1 } from "googleapis";

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedEmail {
  messageId: string;
  threadId: string | null;
  from: { name: string | null; email: string };
  to: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

// ---------------------------------------------------------------------------
// List messages matching a query
// ---------------------------------------------------------------------------

export async function listMessages(
  query: string,
  maxResults: number = 20
): Promise<{ id: string; threadId: string }[]> {
  const gmail = getGmailClient();

  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  if (!res.data.messages) return [];

  return res.data.messages.map((m) => ({
    id: m.id!,
    threadId: m.threadId || m.id!,
  }));
}

// ---------------------------------------------------------------------------
// Get full message by ID
// ---------------------------------------------------------------------------

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || null;
}

function parseFromHeader(from: string | null): { name: string | null; email: string } {
  if (!from) return { name: null, email: "" };
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2].trim() };
  }
  return { name: null, email: from.trim() };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined
): { text: string | null; html: string | null } {
  if (!payload) return { text: null, html: null };

  let text: string | null = null;
  let html: string | null = null;

  function walk(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    }
    if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) walk(child);
    }
  }

  walk(payload);
  return { text, html };
}

function extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined): EmailAttachment[] {
  if (!payload) return [];
  const attachments: EmailAttachment[] = [];

  function walk(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) {
      for (const child of part.parts) walk(child);
    }
  }

  walk(payload);
  return attachments;
}

export async function getMessage(messageId: string): Promise<ParsedEmail> {
  const gmail = getGmailClient();

  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers;
  const from = parseFromHeader(getHeader(headers, "From"));
  const { text, html } = extractBody(msg.payload);
  const attachments = extractAttachments(msg.payload);

  const internalDate = msg.internalDate
    ? new Date(parseInt(msg.internalDate, 10))
    : new Date();

  return {
    messageId: msg.id!,
    threadId: msg.threadId || null,
    from,
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    bodyText: text,
    bodyHtml: html,
    receivedAt: internalDate,
    attachments,
  };
}

// ---------------------------------------------------------------------------
// Mark message as read (remove UNREAD label)
// ---------------------------------------------------------------------------

export async function markAsRead(messageId: string): Promise<void> {
  const gmail = getGmailClient();

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

// ---------------------------------------------------------------------------
// Get attachment data
// ---------------------------------------------------------------------------

export async function getAttachment(
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const gmail = getGmailClient();

  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const data = res.data.data || "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
