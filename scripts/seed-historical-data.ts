/**
 * seed-historical-data.ts
 *
 * Reads the PROJECT_INFO markdown files from /Users/admin/HR BLUE GROUP/PROJECT_INFO/
 * and imports all historical data into Blueprint via the bulk-import API.
 *
 * Usage:
 *   npx tsx scripts/seed-historical-data.ts [--dry-run] [--auto-promote]
 *
 * What it does:
 *   1. Parses 03_DAILY_HR_REPORTS.md (96 daily reports)
 *   2. Parses 04_WEEKLY_CONSOLIDATED_REPORTS.md (25 weekly/consolidated reports)
 *   3. Converts each into "Date: ..." delimited text the bulk-import API expects
 *   4. POSTs to /api/operations/bulk-import/preview for a cost estimate
 *   5. POSTs to /api/operations/bulk-import to run the extraction
 *   6. Parses 06_RESUMES_CANDIDATES.md and uploads each resume to /api/cv/upload
 *
 * Prerequisites:
 *   - The app must be running locally on http://localhost:3000
 *   - Supabase migrations must be applied (especially 002, 003, 006, 007)
 *   - ANTHROPIC_API_KEY must be set in .env.local
 */

import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.SEED_BASE_URL || "http://localhost:3000";
const PROJECT_INFO_DIR =
  process.env.PROJECT_INFO_DIR ||
  path.join("/Users/admin/HR BLUE GROUP/PROJECT_INFO");

const DRY_RUN = process.argv.includes("--dry-run");
const AUTO_PROMOTE = process.argv.includes("--auto-promote");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMd(filename: string): string {
  const p = path.join(PROJECT_INFO_DIR, filename);
  if (!fs.existsSync(p)) {
    console.error(`File not found: ${p}`);
    process.exit(1);
  }
  return fs.readFileSync(p, "utf-8");
}

/**
 * Split a PROJECT_INFO markdown file into individual document blocks.
 * Each block starts with a line like:
 *   ================...
 *   FILE: 00000009-HR Office Manager Daily Report 082725.pdf
 *   ================...
 */
function splitBlocks(md: string): Array<{ filename: string; body: string }> {
  const sep =
    /^={40,}\s*\n\s*FILE:\s*(.+?)\s*\n\s*={40,}\s*$/gm;
  const blocks: Array<{ filename: string; body: string }> = [];
  let lastIndex = 0;
  let lastFilename = "";
  let match: RegExpExecArray | null;

  while ((match = sep.exec(md)) !== null) {
    if (lastFilename) {
      blocks.push({
        filename: lastFilename,
        body: md.slice(lastIndex, match.index).trim(),
      });
    }
    lastFilename = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastFilename) {
    blocks.push({
      filename: lastFilename,
      body: md.slice(lastIndex).trim(),
    });
  }
  return blocks;
}

/**
 * Given the body of a single report, try to extract a Date: line.
 * If no date line exists, inject one from the filename (e.g., "082725" → "08/27/2025").
 */
function ensureDateHeader(body: string, filename: string): string {
  const hasDateLine = /^\s*(?:date|תאריך)\s*[:\-]/im.test(body);
  if (hasDateLine) return body;

  // Try to extract date from filename like "Report 082725.pdf" or "042826"
  const m = filename.match(/(\d{2})(\d{2})(\d{2})/);
  if (m) {
    const [, mm, dd, yy] = m;
    const year = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
    return `Date: ${year}-${mm}-${dd}\n${body}`;
  }

  // Try "Aug 28" or "28 August" etc
  const m2 = filename.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i
  );
  if (m2) {
    return `Date: ${m2[1]} ${m2[2]}, 2025\n${body}`;
  }

  return body; // no date found — extraction will handle it
}

/**
 * Converts parsed report blocks into a single big text blob
 * with "Date: ..." headers that the bulk-import API can split on.
 */
function blocksToReportText(
  blocks: Array<{ filename: string; body: string }>
): string {
  return blocks
    .map((b) => ensureDateHeader(b.body, b.filename))
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function bulkPreview(text: string) {
  const res = await fetch(`${BASE_URL}/api/operations/bulk-import/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

async function bulkImport(
  text: string,
  expectedReports: number,
  autoPromote: boolean
) {
  const res = await fetch(`${BASE_URL}/api/operations/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      expectedReports,
      force: true, // skip dedup for seed
      autoPromote,
    }),
  });
  return res.json();
}

async function uploadResume(name: string, text: string) {
  // The /api/cv/upload endpoint only accepts .pdf and .docx extensions.
  // We create a Blob with the text content but name it .pdf so it passes
  // the extension check. pdf-parse will fail on the raw text, but the
  // endpoint will still have the text from the formData "text" field
  // if we use the seed-specific text-only endpoint instead.
  //
  // Better approach: use a dedicated seed endpoint that accepts text directly.
  const fd = new FormData();
  // Send as a .docx blob — mammoth will fail but we also send text
  // Actually, the cleanest approach: use the Convex candidate create
  // mutation via the app's internal API. But for simplicity, let's just
  // POST to a simple seed endpoint.
  const res = await fetch(`${BASE_URL}/api/seed/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, filename: name }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seedReports(filename: string, label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Seeding ${label} from ${filename}`);
  console.log("=".repeat(60));

  const md = readMd(filename);
  const blocks = splitBlocks(md);
  console.log(`Parsed ${blocks.length} report blocks`);

  if (blocks.length === 0) {
    console.log("No blocks found, skipping");
    return;
  }

  const reportText = blocksToReportText(blocks);

  // Preview first
  console.log("\nFetching preview...");
  const preview = await bulkPreview(reportText);
  console.log(`  Detected reports: ${preview.detectedReports}`);
  console.log(
    `  Date range: ${preview.dateRange?.from || "?"} → ${preview.dateRange?.to || "?"}`
  );
  console.log(
    `  Estimated cost: $${preview.estimatedCostUsd?.toFixed(4) || "?"}`
  );
  console.log(
    `  Tokens: ${preview.estimatedInputTokens?.toLocaleString() || "?"} in / ${preview.estimatedOutputTokens?.toLocaleString() || "?"} out`
  );

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Skipping actual import");
    return;
  }

  // Always process in small batches of 5 to avoid HTTP timeouts.
  // Each report takes ~10-30s of Claude extraction, so 5 reports ≈ 1-2min.
  const BATCH_SIZE = 5;
  let totalDone = 0;
  let totalFailed = 0;

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    const batchText = blocksToReportText(batch);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(blocks.length / BATCH_SIZE);
    console.log(
      `\n  Batch ${batchNum}/${totalBatches} (${batch.length} reports)...`
    );
    try {
      const result = await bulkImport(
        batchText,
        batch.length,
        AUTO_PROMOTE
      );
      if (result.error) {
        console.log(`    ERROR: ${result.error}`);
        totalFailed += batch.length;
      } else {
        const done = result.counts?.done || 0;
        const failed = result.counts?.failed || 0;
        totalDone += done;
        totalFailed += failed;
        console.log(
          `    Status: ${result.status} — done: ${done}, failed: ${failed}`
        );
      }
    } catch (e) {
      console.log(
        `    FETCH ERROR: ${e instanceof Error ? e.message : String(e)}`
      );
      totalFailed += batch.length;
    }
  }

  console.log(
    `\n  TOTAL: ${totalDone} done, ${totalFailed} failed (out of ${blocks.length} blocks)`
  );
}

async function seedResumes() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Seeding candidates from 06_RESUMES_CANDIDATES.md");
  console.log("=".repeat(60));

  const md = readMd("06_RESUMES_CANDIDATES.md");
  const blocks = splitBlocks(md);
  console.log(`Parsed ${blocks.length} candidate documents`);

  // Filter to actual resumes (exclude job offers, interview schedules, etc.)
  const resumeBlocks = blocks.filter((b) => {
    const fn = b.filename.toLowerCase();
    return (
      fn.includes("resume") ||
      fn.includes("cv") ||
      fn.includes("soleta") ||
      fn.includes("applicant") ||
      // Also look for resume-like content
      b.body.toLowerCase().includes("professional summary") ||
      b.body.toLowerCase().includes("work experience") ||
      b.body.toLowerCase().includes("educational background") ||
      b.body.toLowerCase().includes("employment history")
    );
  });

  console.log(
    `Filtered to ${resumeBlocks.length} actual resumes (from ${blocks.length} total documents)`
  );

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Skipping actual upload");
    resumeBlocks.forEach((b) => console.log(`  Would upload: ${b.filename}`));
    return;
  }

  let success = 0;
  let failed = 0;
  for (const block of resumeBlocks) {
    try {
      console.log(`  Uploading: ${block.filename}...`);
      const result = await uploadResume(block.filename, block.body);
      if (result.error) {
        console.log(`    WARN: ${result.error}`);
        failed++;
      } else {
        console.log(
          `    OK: ${result.candidate?.full_name || result.candidateId || "created"}`
        );
        success++;
      }
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.log(
        `    ERROR: ${e instanceof Error ? e.message : String(e)}`
      );
      failed++;
    }
  }
  console.log(`\nResumes: ${success} uploaded, ${failed} failed`);
}

async function main() {
  console.log("Blueprint ATS — Historical Data Seed");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Source: ${PROJECT_INFO_DIR}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Auto-promote: ${AUTO_PROMOTE}`);

  // Verify connectivity
  try {
    const res = await fetch(`${BASE_URL}/api/operations/projects`);
    const body = await res.text();
    if (res.status >= 500) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    console.log(`Server is reachable (status ${res.status})`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("HTTP ")) {
      console.error(`Server error: ${e.message}`);
      process.exit(1);
    }
    console.error(
      `Cannot reach ${BASE_URL}. Is the dev server running? (${e instanceof Error ? e.message : e})`
    );
    process.exit(1);
  }

  // 1. Daily HR reports (96 files)
  await seedReports("03_DAILY_HR_REPORTS.md", "Daily HR Reports");

  // 2. Weekly/consolidated reports (25 files)
  await seedReports("04_WEEKLY_CONSOLIDATED_REPORTS.md", "Weekly/Consolidated Reports");

  // 3. Sample/template reports (4 files — optional context)
  await seedReports("01_SAMPLE_REPORTS.md", "Sample/Template Reports");

  // 4. Resumes and candidates
  await seedResumes();

  console.log("\n" + "=".repeat(60));
  console.log("Seed complete!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
