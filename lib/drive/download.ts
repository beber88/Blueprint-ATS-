import { drive_v3 } from "googleapis";

/** Hard cap on bytes pulled into memory / sent to the model. */
const MAX_BYTES = 12 * 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export type DriveContent =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: string }
  | { kind: "text"; text: string }
  | { kind: "unsupported"; reason: string };

function bufferFrom(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (typeof data === "string") return Buffer.from(data, "binary");
  return Buffer.from(data as ArrayBuffer);
}

/**
 * Fetches a Drive file's content in a form a model can read:
 *  - Google Docs/Sheets/Slides are exported to text/CSV.
 *  - PDFs and images are downloaded as base64 (Claude reads PDFs and
 *    scanned images natively, so no separate OCR engine is needed).
 *  - Plain-text files are downloaded as text.
 * Files larger than MAX_BYTES, or types we can't read, return
 * "unsupported" so the caller can fall back to metadata classification.
 */
export async function downloadDriveContent(
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string | null,
  sizeBytes?: number | null
): Promise<DriveContent> {
  if (sizeBytes && sizeBytes > MAX_BYTES) {
    return { kind: "unsupported", reason: `file too large (${sizeBytes} bytes)` };
  }

  const mime = (mimeType || "").toLowerCase();

  // --- Google-native documents: export -----------------------------------
  if (mime === "application/vnd.google-apps.document") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return { kind: "text", text: String(res.data).slice(0, 60000) };
  }
  if (mime === "application/vnd.google-apps.spreadsheet") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/csv" },
      { responseType: "text" }
    );
    return { kind: "text", text: String(res.data).slice(0, 60000) };
  }
  if (mime === "application/vnd.google-apps.presentation") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return { kind: "text", text: String(res.data).slice(0, 60000) };
  }
  if (mime.startsWith("application/vnd.google-apps.")) {
    return { kind: "unsupported", reason: `unsupported Google type ${mime}` };
  }

  // --- Binary / text downloads -------------------------------------------
  if (mime === "application/pdf") {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const buf = bufferFrom(res.data);
    if (buf.length > MAX_BYTES) {
      return { kind: "unsupported", reason: "pdf too large" };
    }
    return { kind: "pdf", base64: buf.toString("base64") };
  }

  if (IMAGE_TYPES.includes(mime)) {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const buf = bufferFrom(res.data);
    if (buf.length > MAX_BYTES) {
      return { kind: "unsupported", reason: "image too large" };
    }
    return {
      kind: "image",
      base64: buf.toString("base64"),
      mediaType: mime === "image/jpg" ? "image/jpeg" : mime,
    };
  }

  if (mime.startsWith("text/") || mime === "application/json") {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );
    return { kind: "text", text: String(res.data).slice(0, 60000) };
  }

  return { kind: "unsupported", reason: `unsupported mime ${mime || "(unknown)"}` };
}
