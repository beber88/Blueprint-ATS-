/**
 * seed-direct.ts — Direct Supabase + Claude seeding (bypasses Next.js server)
 *
 * Usage: npx tsx scripts/seed-direct.ts [--only=reports|resumes]
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// Load .env.local manually (no dotenv dependency)
const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx < 0) continue;
  const key = line.slice(0, eqIdx).trim();
  const val = line.slice(eqIdx + 1).trim();
  if (/^[A-Z_][A-Z0-9_]*$/.test(key) && val) {
    process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const PROJECT_INFO_DIR = "/Users/admin/HR BLUE GROUP/PROJECT_INFO";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function readMd(filename: string): string {
  return fs.readFileSync(path.join(PROJECT_INFO_DIR, filename), "utf-8");
}

function splitBlocks(md: string): Array<{ filename: string; body: string }> {
  const sep = /^={40,}\s*\n\s*FILE:\s*(.+?)\s*\n\s*={40,}\s*$/gm;
  const blocks: Array<{ filename: string; body: string }> = [];
  let lastIndex = 0;
  let lastFilename = "";
  let match: RegExpExecArray | null;
  while ((match = sep.exec(md)) !== null) {
    if (lastFilename) blocks.push({ filename: lastFilename, body: md.slice(lastIndex, match.index).trim() });
    lastFilename = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastFilename) blocks.push({ filename: lastFilename, body: md.slice(lastIndex).trim() });
  return blocks;
}

function extractDateFromFilename(filename: string): string | null {
  const stripped = filename.replace(/^\d+-/, "");
  const m = stripped.match(/(\d{2})(\d{2})(\d{2})(?:\.\w+)?$/);
  if (m) {
    const [, mm, dd, yy] = m;
    const year = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
    if (parseInt(mm) >= 1 && parseInt(mm) <= 12 && parseInt(dd) >= 1 && parseInt(dd) <= 31)
      return `${year}-${mm}-${dd}`;
  }
  return null;
}

// ─────────────────────────────────────────────────
// Claude extraction (inline, no Next.js)
// ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a structured-data extraction expert for Blueprint Building Group, a Philippine CONSTRUCTION COMPANY.
Return ONLY a JSON object with shape: { "report_date": "YYYY-MM-DD or null", "confidence": 0..1, "notes": "string or null", "items": [{ "department", "project", "person_responsible", "issue", "status": "open|in_progress|blocked|resolved", "deadline", "deadline_raw", "deadline_uncertain", "missing_information", "ceo_decision_needed", "priority": "low|medium|high|urgent", "next_action", "category": "hr|attendance|safety|project|permit|procurement|subcontractor|site|other" }] }
Each distinct issue/task/blocker = one item. Attendance: only absences/issues. CEO items: ceo_decision_needed=true. Keep issue short. Return JSON only.`;

async function extractReport(text: string, dateHint?: string) {
  const userMsg = `DAILY REPORT TEXT:\n\`\`\`\n${text.slice(0, 30000)}\n\`\`\`\n${dateHint ? `Report date hint: ${dateHint}` : ""}\nReturn the JSON object now.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") throw new Error("No text in response");

  let parsed: any;
  try { parsed = JSON.parse(block.text); } catch {
    const m = block.text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error("No JSON found");
  }

  return {
    report_date: parsed.report_date || dateHint || null,
    confidence: parsed.confidence || 0.7,
    notes: parsed.notes || null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

// ─────────────────────────────────────────────────
// DB operations
// ─────────────────────────────────────────────────

async function getExistingDates(): Promise<Set<string>> {
  const { data } = await supabase.from("op_reports").select("report_date");
  return new Set((data || []).map((r: any) => r.report_date));
}

async function insertReport(text: string, ai: any) {
  const { data: report, error } = await supabase.from("op_reports").insert({
    source_type: "text",
    raw_text: text.slice(0, 200_000),
    report_date: ai.report_date || new Date().toISOString().slice(0, 10),
    processing_status: "completed",
    processed_at: new Date().toISOString(),
    source_meta: { from_seed: true, confidence: ai.confidence, notes: ai.notes },
  }).select().single();
  if (error) throw new Error(`insert report: ${error.message}`);
  return report;
}

async function insertItems(reportId: string, reportDate: string, items: any[]) {
  const validStatus = new Set(["open", "in_progress", "blocked", "resolved"]);
  const validPriority = new Set(["low", "medium", "high", "urgent"]);
  const validCategory = new Set(["hr", "attendance", "safety", "project", "permit", "procurement", "subcontractor", "site", "other"]);

  const rows = items.filter((i: any) => i.issue?.trim()).map((i: any) => ({
    report_id: reportId,
    report_date: reportDate,
    department_raw: i.department || null,
    project_raw: i.project || null,
    person_responsible_raw: i.person_responsible || null,
    issue: i.issue,
    status: validStatus.has(i.status) ? i.status : "open",
    deadline: /^\d{4}-\d{2}-\d{2}/.test(i.deadline || "") ? i.deadline.slice(0, 10) : null,
    deadline_raw: i.deadline_raw || null,
    deadline_uncertain: !!i.deadline_uncertain,
    missing_information: i.missing_information || null,
    ceo_decision_needed: !!i.ceo_decision_needed,
    priority: validPriority.has(i.priority) ? i.priority : "medium",
    next_action: i.next_action || null,
    category: validCategory.has(i.category) ? i.category : "other",
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("op_report_items").insert(rows);
    if (error) throw new Error(`insert items: ${error.message}`);
  }
  return rows.length;
}

// ─────────────────────────────────────────────────
// Main seed
// ─────────────────────────────────────────────────

async function seedReports(filename: string, label: string) {
  console.log(`\n${"=".repeat(60)}\n${label}\n${"=".repeat(60)}`);
  const blocks = splitBlocks(readMd(filename));
  console.log(`${blocks.length} report blocks`);

  const existing = await getExistingDates();
  console.log(`${existing.size} dates already in DB`);

  let done = 0, skipped = 0, failed = 0;
  for (let i = 0; i < blocks.length; i++) {
    const { filename: fn, body } = blocks[i];
    const dateHint = extractDateFromFilename(fn);
    if (body.length < 50) { skipped++; continue; }
    if (dateHint && existing.has(dateHint)) { skipped++; continue; }

    process.stdout.write(`  [${i + 1}/${blocks.length}] ${fn.slice(0, 50)}...`);
    try {
      const ai = await extractReport(body, dateHint || undefined);
      const effectiveDate = ai.report_date || dateHint || new Date().toISOString().slice(0, 10);
      ai.report_date = effectiveDate;
      const report = await insertReport(body, ai);
      const count = await insertItems(report.id, effectiveDate, ai.items);
      existing.add(effectiveDate); // prevent dups within same run
      done++;
      console.log(` OK (${count} items)`);
    } catch (e: any) {
      failed++;
      console.log(` ERROR: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`TOTAL: ${done} done, ${skipped} skipped, ${failed} failed`);
}

async function seedResumes() {
  console.log(`\n${"=".repeat(60)}\nResumes\n${"=".repeat(60)}`);
  const blocks = splitBlocks(readMd("06_RESUMES_CANDIDATES.md"));
  const resumeBlocks = blocks.filter((b) => {
    const fn = b.filename.toLowerCase();
    return fn.includes("resume") || fn.includes("cv") ||
      b.body.toLowerCase().includes("professional summary") ||
      b.body.toLowerCase().includes("work experience") ||
      b.body.toLowerCase().includes("educational background");
  });
  console.log(`${resumeBlocks.length} resumes (from ${blocks.length} docs)`);

  let done = 0, dupes = 0, failed = 0;
  for (const block of resumeBlocks) {
    if (block.body.length < 50) { failed++; continue; }
    process.stdout.write(`  ${block.filename.slice(0, 50)}...`);
    try {
      // Parse with Claude
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: `Parse this resume and return JSON: { "full_name", "email", "phone", "location", "experience_years", "skills": [], "education", "certifications": [], "previous_roles": [], "job_categories": [] }\n\nRESUME:\n${block.body.slice(0, 15000)}` }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("No JSON");
      const parsed = JSON.parse(m[0]);

      // Dedup
      if (parsed.email) {
        const { data } = await supabase.from("candidates").select("id").eq("email", parsed.email).single();
        if (data) { dupes++; console.log(` DUPE (${parsed.full_name})`); continue; }
      }

      const { error } = await supabase.from("candidates").insert({
        full_name: parsed.full_name || "Unknown",
        email: parsed.email || null,
        phone: parsed.phone || null,
        location: parsed.location || null,
        cv_raw_text: block.body.slice(0, 100_000),
        skills: parsed.skills || [],
        experience_years: parsed.experience_years || null,
        education: parsed.education || null,
        certifications: parsed.certifications || [],
        previous_roles: parsed.previous_roles || [],
        source: "seed_import",
        status: "new",
        job_categories: parsed.job_categories || [],
      });
      if (error) throw new Error(error.message);
      done++;
      console.log(` OK (${parsed.full_name})`);
    } catch (e: any) {
      failed++;
      console.log(` ERROR: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`Resumes: ${done} new, ${dupes} dupes, ${failed} failed`);
}

// ─────────────────────────────────────────────────
// Seed contracts
// ─────────────────────────────────────────────────

const CONTRACT_KEYWORDS = [
  "contract", "agreement", "lease", "engagement", "addendum",
  "settlement", "scaffolding cost transfer", "construction agreement",
  "vehicle rental", "proposal", "quotation", "purchase order",
  "final pay", "final notice", "project final turn over",
  "billing", "work order", "scope of work", "mechanical",
];

async function seedContracts() {
  console.log(`\n${"=".repeat(60)}\nContracts\n${"=".repeat(60)}`);

  const sources = [
    "05_PEARL_DE_FLORE.md",
    "09_OTHER_DOCUMENTS.md",
    "07_HR_DOCUMENTATION.md",
    "08_PAYROLL_INVENTORY.md",
  ];

  const allBlocks: Array<{ filename: string; body: string }> = [];
  for (const src of sources) {
    const blocks = splitBlocks(readMd(src));
    for (const b of blocks) {
      const fn = b.filename.toLowerCase();
      if (CONTRACT_KEYWORDS.some((kw) => fn.includes(kw)) && b.body.length > 50) {
        allBlocks.push(b);
      }
    }
  }

  console.log(`${allBlocks.length} contract documents found`);

  // Check existing
  const { data: existing } = await supabase.from("ct_contracts").select("title");
  const existingTitles = new Set((existing || []).map((c: any) => c.title?.toLowerCase()));

  let done = 0, skipped = 0, failed = 0;
  for (const block of allBlocks) {
    process.stdout.write(`  ${block.filename.slice(0, 55)}...`);
    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: `Parse this contract/agreement document for Blueprint Building Group (Philippine construction company) and return JSON:
{
  "category": "customer" | "subcontractor" | "vendor",
  "counterparty_name": "full legal name of the other party",
  "counterparty_contact_name": "contact person name or null",
  "counterparty_contact_email": "email or null",
  "counterparty_contact_phone": "phone or null",
  "title": "short descriptive title (max 80 chars)",
  "summary": "Detailed 5-8 sentence summary: what is this contract about, what work/services are covered, key terms, payment structure, any special conditions or risks. Be specific about scope of work, materials, areas of responsibility.",
  "project_name": "which Blueprint project this relates to (e.g. 'Pearl de Flore', 'Icon 18H', 'Tresor Rare', 'Fixifoot', 'Bohol', '4 Storey') or null",
  "signing_date": "YYYY-MM-DD or null",
  "effective_date": "YYYY-MM-DD or null",
  "expiration_date": "YYYY-MM-DD or null",
  "monetary_value": number or null (in PHP unless stated otherwise),
  "currency": "PHP" or "USD" or null,
  "status": "active" | "expired" | "terminated"
}

DOCUMENT:
${block.body.slice(0, 20000)}`
        }],
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("No JSON");
      const parsed = JSON.parse(m[0]);

      // Dedup by title
      if (existingTitles.has((parsed.title || "").toLowerCase())) {
        skipped++;
        console.log(` DUPE`);
        continue;
      }

      // Match project
      let projectId = null;
      if (parsed.project_name) {
        const { data: proj } = await supabase
          .from("op_projects")
          .select("id")
          .ilike("name", `%${parsed.project_name.split(" ")[0]}%`)
          .limit(1)
          .single();
        if (proj) projectId = proj.id;
      }

      const validCategory = ["customer", "subcontractor", "vendor"].includes(parsed.category)
        ? parsed.category : "vendor";
      const validStatus = ["draft", "active", "expired", "terminated", "renewed"].includes(parsed.status)
        ? parsed.status : "active";

      const { error } = await supabase.from("ct_contracts").insert({
        category: validCategory,
        counterparty_name: parsed.counterparty_name || "Unknown",
        counterparty_contact_name: parsed.counterparty_contact_name || null,
        counterparty_contact_email: parsed.counterparty_contact_email || null,
        counterparty_contact_phone: parsed.counterparty_contact_phone || null,
        project_id: projectId,
        title: parsed.title || block.filename,
        summary: parsed.summary || null,
        signing_date: parsed.signing_date || null,
        effective_date: parsed.effective_date || null,
        expiration_date: parsed.expiration_date || null,
        monetary_value: parsed.monetary_value || null,
        currency: parsed.currency || "PHP",
        status: validStatus,
      });
      if (error) throw new Error(error.message);

      existingTitles.add((parsed.title || "").toLowerCase());
      done++;
      console.log(` OK (${parsed.title})`);
    } catch (e: any) {
      failed++;
      console.log(` ERROR: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`Contracts: ${done} new, ${skipped} dupes, ${failed} failed`);
}

async function main() {
  console.log("Blueprint ATS — Direct Seed (no Next.js)");
  if (!ONLY || ONLY === "reports") {
    await seedReports("03_DAILY_HR_REPORTS.md", "Daily HR Reports");
    await seedReports("04_WEEKLY_CONSOLIDATED_REPORTS.md", "Weekly/Consolidated Reports");
    await seedReports("01_SAMPLE_REPORTS.md", "Sample/Template Reports");
  }
  if (!ONLY || ONLY === "resumes") {
    await seedResumes();
  }
  if (!ONLY || ONLY === "contracts") {
    await seedContracts();
  }
  console.log("\nDone!");
}

main().catch(console.error);
