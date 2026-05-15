import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedReport, ExtractedItem } from "@/lib/operations/types";

const MODEL = "claude-sonnet-4-20250514";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}

function extractJSON<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /* noop */ }
  const code = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (code) {
    try { return JSON.parse(code[1].trim()) as T; } catch { /* noop */ }
  }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]) as T;
  throw new Error("Failed to extract JSON from Claude response");
}

const SYSTEM_PROMPT = `You are a structured-data extraction expert for Blueprint Building Group, a Philippine CONSTRUCTION COMPANY.
The reports you ingest are daily operational reports for a CEO. They follow the company's standard format, mixing English and Hebrew/Tagalog freely.

The reports are usually structured in these sections (any subset may appear):
  1. HR – Human Resources (attendance, hiring, onboarding/offboarding, urgent HR cases)
  2. Administration & Secretary (permits, key office updates, meetings, approvals)
  3. Architecture Department (per-project tasks completed, progress %, files delivered, blockers, tomorrow plan)
  4. Project Management & Site Updates (per-project manpower, work completed, % progress, blockers, materials needed + ETA, tomorrow plan, urgent risks)
  5. Procurement Department (daily procurement summary, orders placed, deliveries received, delays/backorders, supplier issues, CEO decisions needed)
  6. Missing Information Tracker (item, from whom, deadline)
  7. CEO Action Items (item, why needed, deadline)
  8. Company Priorities for Tomorrow

Real project names commonly mentioned: Pearl de Flore, Fixifoot Grand Westside, Icon 18H, Icon 2H, 4 Storey (Pampanga), Tresor Rare (Manila Bay), Pulu Amsic, Vitalite, LCT (Kedma), JPL, Villa 9, Villa 3, BGC Spa, Elle Iloilo, Trinoma Kiosk, Opatra Gensan, Fort Legend, Emanuelle Eton, Reshape, The Dreame, Voupre, Panglao Prime Villas, Bohol Project, Manila Bay, Aziza, Mella, Venus, L300.

Real department names: HR, Administration, Architecture, Project Management, Procurement, QS (Quantity Surveying), Finance, Maintenance/Repair, Security, Site.

Your job: read the report text and return a JSON object describing the items.

OUTPUT JSON SHAPE (return ONLY this — no prose, no markdown):
{
  "report_date": "YYYY-MM-DD or null",
  "confidence": 0..1,
  "notes": "string or null - any high-level observation about the report",
  "items": [
    {
      "department": "string or null - HR | Administration | Architecture | Project Management | Procurement | QS | Maintenance | Site | etc.",
      "project": "string or null - which project this item belongs to (e.g. 'Pearl de Flore', 'Icon 18H', '4 Storey')",
      "person_responsible": "string or null - verbatim name(s) of who is responsible, e.g. 'Nicx', 'Jester', 'James', 'Renz Group'",
      "issue": "string - one-sentence concise description of the issue, task, blocker, or update",
      "status": "open | in_progress | blocked | resolved",
      "deadline": "YYYY-MM-DD or null - parsed deadline date if it can be inferred",
      "deadline_raw": "string or null - the verbatim deadline phrase (e.g. 'May 13, 2026', 'tomorrow', 'within the week', 'Monday', 'Immediate', 'Urgent')",
      "deadline_uncertain": true | false - true if the deadline is relative ('next week', 'soon', 'ASAP', 'urgent') or had to be guessed,
      "missing_information": "string or null - what info is missing to act on this item (corresponds to the report's 'Missing Information Tracker')",
      "ceo_decision_needed": true | false - set true for items in the 'CEO Action Items' / 'CEO Decisions Needed' sections, OR items that explicitly ask for CEO/owner approval/escalation,
      "priority": "low | medium | high | urgent",
      "next_action": "string or null - the next step / tomorrow plan / planned action",
      "category": "hr | attendance | safety | project | permit | procurement | subcontractor | site | other"
    }
  ]
}

EXTRACTION RULES:
- Each distinct issue, task, blocker, missing item, CEO decision, or operational update in the report becomes ONE item. Aim to extract everything actionable.
- The "Attendance" sub-section: do NOT explode each present employee into a separate item. Only create attendance items for ABSENCES, late arrivals, no-shows, sick leaves, or anything that needs attention. Set category='attendance'.
- The "Missing Information Tracker" section: each line becomes an item with missing_information populated and category appropriate to the topic.
- The "CEO Action Items" / "CEO Decisions Needed" lines: each becomes an item with ceo_decision_needed=true.
- The "Company Priorities for Tomorrow" section: each priority becomes an item, typically with status='open', category='other'.
- Per-project site updates: create separate items for each distinct issue/blocker/material need within the project — don't collapse them into one item. Each material-needed line is its own item with category='procurement' and the missing material in the issue/next_action.
- Permit / regulatory / mall-admin issues → category='permit'.
- Subcontractor issues (James, Arnel, Renz, ANP, April Renn, etc.) → category='subcontractor'.
- Items labelled 'urgent', 'דחוף', 'immediate', 'ASAP', or with deadline today/yesterday → priority='urgent'.
- Items with concrete deadlines tomorrow or this week → priority='high'.
- Routine progress notes without blockers → priority='medium' or 'low'.
- Hebrew/Tagalog/English mixing is expected. Translate context but preserve proper names (Nicx, MC, James, etc.) verbatim in person_responsible.
- For deadline: produce best-effort YYYY-MM-DD AND set deadline_uncertain=true for relative phrases.
- Keep "issue" short (one sentence). Move detail into next_action and missing_information.
- Department should be a single short label, not a sentence.
- If a piece of information is missing from the source, use null. NEVER invent facts.

Return JSON only.`;

export interface ExtractOptions {
  reporterName?: string | null;
  defaultProject?: string | null;
  reportDate?: string | null; // YYYY-MM-DD hint (e.g. inferred from upload date)
  locale?: "he" | "en" | "tl";
}

function buildUserMessage(text: string, opts: ExtractOptions): string {
  const lines: string[] = [];
  lines.push("DAILY REPORT TEXT:");
  lines.push("```");
  lines.push(text.length > 30000 ? text.slice(0, 30000) + "\n...[truncated]" : text);
  lines.push("```");
  if (opts.reporterName) lines.push(`Reporter context: submitted by ${opts.reporterName}`);
  if (opts.defaultProject) lines.push(`Default project context: ${opts.defaultProject}`);
  if (opts.reportDate) lines.push(`Report date hint: ${opts.reportDate}`);
  lines.push(`Source locale hint: ${opts.locale || "he"}`);
  if (opts.locale === "he" || !opts.locale) {
    lines.push("CRITICAL: Write ALL free-text fields (issue, next_action, missing_information, notes) in HEBREW. Keep proper nouns (people names, project names, company names) in their original script.");
  } else if (opts.locale === "tl") {
    lines.push("CRITICAL: Write ALL free-text fields (issue, next_action, missing_information, notes) in TAGALOG. Keep proper nouns in their original script.");
  }
  lines.push("");
  lines.push("Return the JSON object now.");
  return lines.join("\n");
}

function normalizeItems(raw: unknown): ExtractedItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => {
    const status = ["open", "in_progress", "blocked", "resolved"].includes(String(r.status)) ? String(r.status) : "open";
    const priority = ["low", "medium", "high", "urgent"].includes(String(r.priority)) ? String(r.priority) : "medium";
    const category = ["hr", "attendance", "safety", "project", "permit", "procurement", "subcontractor", "site", "other"].includes(String(r.category))
      ? String(r.category)
      : "other";
    return {
      department: typeof r.department === "string" ? r.department : null,
      project: typeof r.project === "string" ? r.project : null,
      person_responsible: typeof r.person_responsible === "string" ? r.person_responsible : null,
      issue: typeof r.issue === "string" ? r.issue : "",
      status: status as ExtractedItem["status"],
      deadline: typeof r.deadline === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.deadline) ? r.deadline.slice(0, 10) : null,
      deadline_raw: typeof r.deadline_raw === "string" ? r.deadline_raw : null,
      deadline_uncertain: r.deadline_uncertain === true,
      missing_information: typeof r.missing_information === "string" && r.missing_information.trim() ? r.missing_information : null,
      ceo_decision_needed: r.ceo_decision_needed === true,
      priority: priority as ExtractedItem["priority"],
      next_action: typeof r.next_action === "string" && r.next_action.trim() ? r.next_action : null,
      category: category as ExtractedItem["category"],
    };
  }).filter((i) => i.issue.trim().length > 0);
}

export async function extractReportItems(
  text: string,
  opts: ExtractOptions = {}
): Promise<ExtractedReport> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(text, opts) }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") throw new Error("Unexpected Claude response type");
  const parsed = extractJSON<{
    report_date?: string;
    confidence?: number;
    notes?: string;
    items?: unknown;
  }>(block.text);

  return {
    items: normalizeItems(parsed.items),
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
    model: MODEL,
    report_date: typeof parsed.report_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(parsed.report_date)
      ? parsed.report_date.slice(0, 10)
      : opts.reportDate || null,
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
  };
}

// Image variant — pass a base64 image buffer from a WhatsApp media attachment.
// Claude vision OCRs the report photo and returns the same structured shape.
export async function extractReportItemsFromImage(
  imageBase64: string,
  imageMediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  opts: ExtractOptions = {}
): Promise<ExtractedReport> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: imageMediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: [
              "The image above is a daily operations report (likely a photo of a printed page or a screenshot).",
              "Read all visible text and extract items as instructed in the system prompt.",
              opts.reporterName ? `Reporter context: submitted by ${opts.reporterName}` : "",
              opts.defaultProject ? `Default project context: ${opts.defaultProject}` : "",
              opts.reportDate ? `Report date hint: ${opts.reportDate}` : "",
              `Source locale hint: ${opts.locale || "he"}`,
              (opts.locale === "he" || !opts.locale) ? "CRITICAL: Write ALL free-text fields (issue, next_action, missing_information, notes) in HEBREW. Keep proper nouns in their original script." : "",
              opts.locale === "tl" ? "CRITICAL: Write ALL free-text fields in TAGALOG. Keep proper nouns in their original script." : "",
              "Return the JSON object now.",
            ].filter(Boolean).join("\n"),
          },
        ],
      },
    ],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") throw new Error("Unexpected Claude response type");
  const parsed = extractJSON<{
    report_date?: string;
    confidence?: number;
    notes?: string;
    items?: unknown;
  }>(block.text);

  return {
    items: normalizeItems(parsed.items),
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.6,
    model: MODEL,
    report_date: typeof parsed.report_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(parsed.report_date)
      ? parsed.report_date.slice(0, 10)
      : opts.reportDate || null,
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
  };
}
