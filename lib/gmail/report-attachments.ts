import { getAttachment, ParsedEmail } from "@/lib/gmail/reader";

/**
 * Shared helpers for pulling report documents (PDF/DOCX) out of emails.
 * Used by the email ingest cron and the backfill maintenance endpoint.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ReportAttachment {
  filename: string;
  kind: "pdf" | "docx";
  buffer: Buffer;
}

export function findReportAttachmentMeta(email: ParsedEmail) {
  return email.attachments.find((a) => {
    if (a.size > MAX_ATTACHMENT_BYTES) return false;
    const name = a.filename.toLowerCase();
    return (
      a.mimeType === "application/pdf" ||
      name.endsWith(".pdf") ||
      a.mimeType === DOCX_MIME ||
      name.endsWith(".docx")
    );
  });
}

export async function loadReportAttachment(
  email: ParsedEmail
): Promise<ReportAttachment | null> {
  const meta = findReportAttachmentMeta(email);
  if (!meta) return null;
  try {
    const buffer = await getAttachment(email.messageId, meta.attachmentId);
    const isPdf =
      meta.mimeType === "application/pdf" || meta.filename.toLowerCase().endsWith(".pdf");
    return { filename: meta.filename, kind: isPdf ? "pdf" : "docx", buffer };
  } catch (err) {
    console.error(`report-attachments: failed to download ${meta.filename}`, err);
    return null;
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err) {
    console.error("report-attachments: DOCX extraction failed", err);
    return "";
  }
}
