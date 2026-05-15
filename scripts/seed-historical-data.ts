/**
 * seed-historical-data.ts
 *
 * Reads the PROJECT_INFO markdown files from /Users/admin/HR BLUE GROUP/PROJECT_INFO/
 * and imports all historical data into Blueprint via the single-extract API.
 *
 * Usage:
 *   npx tsx scripts/seed-historical-data.ts [--dry-run] [--auto-promote] [--skip-existing] [--only=reports|resumes]
 *
 * What it does:
 *   1. Parses 03_DAILY_HR_REPORTS.md (96 daily reports)
 *   2. Parses 04_WEEKLY_CONSOLIDATED_REPORTS.md (25 weekly/consolidated reports)
 *   3. Sends each report individually to /api/operations/intake/extract
 *   4. Auto-promotes drafts with /api/operations/drafts/:id/save
 *   5. Parses 06_RESUMES_CANDIDATES.md and creates candidates via /api/seed/candidate
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
const SKIP_EXISTING = process.argv.includes("--skip-existing");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

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

function splitBlocks(md: string): Array<{ filename: string; body: string }> {
  const sep = /^={40,}\s*\n\s*FILE:\s*(.+?)\s*\n\s*={40,}\s*$/gm;
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
    blocks.push({ filename: lastFilename, body: md.slice(lastIndex).trim() });
  }
  return blocks;
}

/**
 * Try to extract a report date from filename MMDDYY pattern.
 * The filename has a numeric prefix like "00000009-" which we skip.
 */
function extractDateFromFilename(filename: string): string | null {
  // Strip the numeric prefix (e.g., "00000009-")
  const stripped = filename.replace(/^\d+-/, "");

  // Try MMDDYY at the end of the name (before extension)
  const m = stripped.match(/(\d{2})(\d{2})(\d{2})(?:\.\w+)?$/);
  if (m) {
    const [, mm, dd, yy] = m;
    const year = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
    const month = parseInt(mm, 10);
    const day = parseInt(dd, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${mm}-${dd}`;
    }
  }

  // Try "Aug 28" or "Month DD" in filename
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    january: "01", february: "02", march: "03", april: "04",
    june: "06", july: "07", august: "08", september: "09",
    october: "10", november: "11", december: "12",
  };
  const m2 = stripped.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i
  );
  if (m2) {
    const mo = months[m2[1].toLowerCase()];
    if (mo) return `2025-${mo}-${m2[2].padStart(2, "0")}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Existing dates check (for --skip-existing)
// ---------------------------------------------------------------------------

async function getExistingReportDates(): Promise<Set<string>> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/operations/dashboard/stats`
    );
    const data = await res.json();
    const dates = new Set<string>();
    for (const r of data.reports || []) {
      if (r.report_date) dates.add(r.report_date);
    }
    return dates;
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Single report extraction
// ---------------------------------------------------------------------------

async function extractSingleReport(
  text: string,
  reportDate?: string
): Promise<{ draftId?: string; error?: string }> {
  // Try API first, fall back to direct Supabase if auth blocks it
  const res = await fetch(`${BASE_URL}/api/operations/intake/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      reportDate: reportDate || undefined,
    }),
  });

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // Server returned HTML (auth redirect or crash) — use seed endpoint
    return extractViaDirectApi(text, reportDate);
  }
  return res.json();
}

async function extractViaDirectApi(
  text: string,
  reportDate?: string
): Promise<{ draftId?: string; error?: string }> {
  // Uses the seed/extract endpoint which has no auth
  const res = await fetch(`${BASE_URL}/api/seed/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, reportDate }),
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return { error: "Server returned HTML — likely crashed" };
  }
  return res.json();
}

async function promoteDraft(
  draftId: string
): Promise<{ reportId?: string; itemsCount?: number; error?: string }> {
  const res = await fetch(
    `${BASE_URL}/api/seed/promote/${draftId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    }
  );
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return { error: "Server returned HTML — likely crashed" };
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Seed reports (one at a time via single-extract)
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

  // Check existing dates if --skip-existing
  const existingDates = SKIP_EXISTING
    ? await getExistingReportDates()
    : new Set<string>();
  if (SKIP_EXISTING) {
    console.log(`  Already have ${existingDates.size} report dates in DB`);
  }

  if (DRY_RUN) {
    for (const b of blocks) {
      const date = extractDateFromFilename(b.filename);
      const skip = date && existingDates.has(date) ? " [SKIP]" : "";
      console.log(`  ${b.filename} → date hint: ${date || "auto"}${skip}`);
    }
    console.log(`\n[DRY RUN] Would process ${blocks.length} reports`);
    return;
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const dateHint = extractDateFromFilename(block.filename);

    // Skip if already imported
    if (SKIP_EXISTING && dateHint && existingDates.has(dateHint)) {
      skipped++;
      continue;
    }

    // Skip very short texts
    if (block.body.length < 50) {
      console.log(
        `  [${i + 1}/${blocks.length}] ${block.filename} — SKIP (too short: ${block.body.length} chars)`
      );
      skipped++;
      continue;
    }

    console.log(
      `  [${i + 1}/${blocks.length}] ${block.filename} (date hint: ${dateHint || "auto"})...`
    );

    try {
      // Extract via Claude
      const extract = await extractSingleReport(block.body, dateHint || undefined);
      if (extract.error) {
        console.log(`    EXTRACT ERROR: ${extract.error}`);
        failed++;
        continue;
      }
      if (!extract.draftId) {
        console.log(`    ERROR: no draftId returned`);
        failed++;
        continue;
      }

      // Auto-promote if requested
      if (AUTO_PROMOTE) {
        const promote = await promoteDraft(extract.draftId);
        if (promote.error) {
          console.log(
            `    Draft created but promote failed: ${promote.error}`
          );
          done++; // draft still exists
        } else {
          console.log(
            `    OK → report ${promote.reportId} (${promote.itemsCount} items)`
          );
          done++;
        }
      } else {
        console.log(`    Draft ${extract.draftId} created`);
        done++;
      }
    } catch (e) {
      console.log(
        `    FETCH ERROR: ${e instanceof Error ? e.message : String(e)}`
      );
      failed++;
    }
  }

  console.log(
    `\n  TOTAL: ${done} done, ${skipped} skipped, ${failed} failed (out of ${blocks.length})`
  );
}

// ---------------------------------------------------------------------------
// Seed resumes
// ---------------------------------------------------------------------------

async function seedResumes() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Seeding candidates from 06_RESUMES_CANDIDATES.md");
  console.log("=".repeat(60));

  const md = readMd("06_RESUMES_CANDIDATES.md");
  const blocks = splitBlocks(md);
  console.log(`Parsed ${blocks.length} candidate documents`);

  const resumeBlocks = blocks.filter((b) => {
    const fn = b.filename.toLowerCase();
    return (
      fn.includes("resume") ||
      fn.includes("cv") ||
      fn.includes("soleta") ||
      fn.includes("applicant") ||
      b.body.toLowerCase().includes("professional summary") ||
      b.body.toLowerCase().includes("work experience") ||
      b.body.toLowerCase().includes("educational background") ||
      b.body.toLowerCase().includes("employment history")
    );
  });

  console.log(
    `Filtered to ${resumeBlocks.length} actual resumes (from ${blocks.length} total)`
  );

  if (DRY_RUN) {
    resumeBlocks.forEach((b) => console.log(`  Would upload: ${b.filename}`));
    return;
  }

  let success = 0;
  let dupes = 0;
  let failed = 0;

  for (const block of resumeBlocks) {
    if (block.body.length < 50) {
      console.log(`  ${block.filename} — SKIP (too short)`);
      failed++;
      continue;
    }

    try {
      console.log(`  Uploading: ${block.filename}...`);
      const res = await fetch(`${BASE_URL}/api/seed/candidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: block.body, filename: block.filename }),
      });

      if (!res.ok && res.headers.get("content-type")?.includes("text/html")) {
        // Server returned HTML error page — likely crashed/restarting
        console.log(`    ERROR: Server returned HTML (likely timeout). Waiting 5s...`);
        failed++;
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const result = await res.json();
      if (result.duplicate) {
        console.log(`    DUPE: ${result.existing_name || result.candidate?.full_name || "?"}`);
        dupes++;
      } else if (result.error) {
        console.log(`    WARN: ${result.error}`);
        failed++;
      } else {
        console.log(
          `    OK: ${result.candidate?.full_name || result.candidateId || "created"}`
        );
        success++;
      }
    } catch (e) {
      console.log(
        `    ERROR: ${e instanceof Error ? e.message : String(e)}`
      );
      failed++;
    }
  }
  console.log(`\nResumes: ${success} new, ${dupes} duplicates, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Blueprint ATS — Historical Data Seed (v2 — single-extract)");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Source: ${PROJECT_INFO_DIR}`);
  console.log(`Flags: dry=${DRY_RUN} promote=${AUTO_PROMOTE} skip=${SKIP_EXISTING} only=${ONLY || "all"}`);

  // Verify connectivity
  try {
    const res = await fetch(`${BASE_URL}/api/operations/projects`);
    const body = await res.text();
    if (res.status >= 500) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    console.log(`Server is reachable`);
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

  if (!ONLY || ONLY === "reports") {
    await seedReports("03_DAILY_HR_REPORTS.md", "Daily HR Reports");
    await seedReports("04_WEEKLY_CONSOLIDATED_REPORTS.md", "Weekly/Consolidated Reports");
    await seedReports("01_SAMPLE_REPORTS.md", "Sample/Template Reports");
  }

  if (!ONLY || ONLY === "resumes") {
    await seedResumes();
  }

  console.log("\n" + "=".repeat(60));
  console.log("Seed complete!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
