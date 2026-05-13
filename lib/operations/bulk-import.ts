import crypto from "crypto";

// Hard cap on reports per bulk import. Configurable via env.
export const BULK_IMPORT_MAX_REPORTS = parseInt(
  process.env.BULK_IMPORT_MAX_REPORTS || "200",
  10
);

// Max concurrent Claude extractions while a job is running. Configurable.
export const BULK_IMPORT_CONCURRENCY = parseInt(
  process.env.BULK_IMPORT_CONCURRENCY || "10",
  10
);

// Stable sha256 hex of the pasted text. Used to detect duplicate bulk batches.
// Normalizes line endings + trailing whitespace so a paste that only differs
// in CRLF vs LF still matches a previous run.
export function hashSourceText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

// Window during which an identical batch is treated as a duplicate.
// 24 hours by default — long enough to catch accidental re-paste, short
// enough that a legitimate full re-import a week later is allowed.
export const DEDUP_WINDOW_HOURS = parseInt(
  process.env.BULK_IMPORT_DEDUP_WINDOW_HOURS || "24",
  10
);

export interface PreviewResult {
  detectedReports: number;
  dateRange: { from: string | null; to: string | null };
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  capExceeded: boolean;
  cap: number;
  sourceTextHash: string;
  duplicateJobId?: string;
  duplicateJobCreatedAt?: string;
}
