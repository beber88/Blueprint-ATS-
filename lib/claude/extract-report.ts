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

const SYSTEM_PROMPT = `You are a structured-data extraction expert for a CONSTRUCTION COMPANY's daily operations report.
Each report (Hebrew, English, or mixed) lists issues that arose across departments and projects.

Your job: read the report text and return a JSON object describing the items.

OUTPUT JSON SHAPE (return ONLY this — no prose, no markdown):
{
  "report_date": "YYYY-MM-DD or null",
  "confidence": 0..1,
  "notes": "string or null - any high-level observation about the report",
  "items": [
    {
      "department": "string or null - which department (HR, Site, Procurement, Finance, Engineering, Safety, etc.)",
      "project": "string or null - project name or code if mentioned",
      "person_responsible": "string or null - the person responsible for this item, verbatim",
      "issue": "string - concise description of the issue/task/blocker",
      "status": "open | in_progress | blocked | resolved",
      "deadline": "YYYY-MM-DD or null - parsed deadline date if it can be inferred",
      "deadline_raw": "string or null - the verbatim deadline text (e.g. 'עד יום ראשון', 'next Tuesday', 'end of week')",
      "deadline_uncertain": true | false - true if the deadline is relative ('next week', 'soon') and you had to guess,
      "missing_information": "string or null - what info is missing to act on this item",
      "ceo_decision_needed": true | false - set true if the report asks for CEO approval/decision/escalation,
      "priority": "low | medium | high | urgent",
      "next_action": "string or null - the next step to take",
      "category": "hr | attendance | safety | project | permit | procurement | subcontractor | site | other"
    }
  ]
}

EXTRACTION RULES:
- Treat absences, lateness, no-shows, attendance issues as category="attendance".
- Treat work permits, building permits, regulatory paperwork as category="permit".
- Treat issues involving a subcontractor as category="subcontractor".
- Treat issues that explicitly ask for CEO/owner approval/decision as ceo_decision_needed=true.
- For priority: anything labelled "דחוף", "urgent", "ASAP" → "urgent". Items with deadlines today/yesterday → "urgent" or "high". Routine items → "medium" or "low".
- Hebrew dates ("יום ראשון", "סוף השבוע") → produce best-effort YYYY-MM-DD AND set deadline_uncertain=true.
- If a piece of information is missing from the source, use null. NEVER invent facts.
- Each distinct issue/task in the report becomes one item.
- Keep "issue" short (one sentence). Put long context into "next_action" or "missing_information".
- "department" should be a single short label, not a sentence.

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
