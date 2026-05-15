import Anthropic from "@anthropic-ai/sdk";

export interface HrDocumentClassification {
  document_type:
    | "contract"
    | "payslip"
    | "id"
    | "government"
    | "certificate"
    | "warning"
    | "achievement"
    | "report"
    | "attendance"
    | "medical"
    | "tax"
    | "other";
  confidence: number;
  employee_name: string | null;
  effective_date: string | null;
  language: "he" | "en" | "tl" | "unknown";
  summary: string;
  reasoning: string;
  target_table_hint: "hr_employee_documents" | "hr_payslips" | "ct_contracts" | "hr_attendance" | "skip";
}

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}

function extractJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fallthrough */
  }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      /* fallthrough */
    }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as T;
  }
  throw new Error("Failed to extract JSON from classifier response");
}

/**
 * Classify a Drive file using only its metadata (name, parent path, mime type).
 * For now we don't download bytes — that's a Phase 3+ enhancement (OCR / PDF text).
 */
export async function classifyDriveFileByMetadata(input: {
  fileName: string;
  parentFolderPath?: string | null;
  mimeType?: string | null;
}): Promise<HrDocumentClassification> {
  const client = getClient();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are an HR document router for a construction company. Classify this Drive file based on filename and folder path. Files come from a HR drive that mixes Hebrew, English, and Tagalog (Filipino) names.

File name: ${input.fileName}
Folder path: ${input.parentFolderPath || "(unknown)"}
MIME type: ${input.mimeType || "(unknown)"}

Return ONLY valid JSON:
{
  "document_type": "contract | payslip | id | government | certificate | warning | achievement | report | attendance | medical | tax | other",
  "confidence": number 0-100,
  "employee_name": "full name extracted from filename/path, or null",
  "effective_date": "ISO date YYYY-MM-DD if you can infer one, else null",
  "language": "he | en | tl | unknown",
  "summary": "1 short sentence",
  "reasoning": "1 sentence",
  "target_table_hint": "hr_employee_documents | hr_payslips | ct_contracts | hr_attendance | skip"
}

Rules:
- payslip / salary slip / "תלוש" / "תלוש שכר" => document_type=payslip, target=hr_payslips
- contract / "חוזה" / "kontrata" => contract, target=ct_contracts
- SSS / Philhealth / Pag-IBIG / TIN / BIR / "ביטוח לאומי" => government, target=hr_employee_documents
- daily time record / DTR / attendance sheet => attendance, target=hr_attendance
- ID, passport, driver's license => id, target=hr_employee_documents
- Anything you cannot confidently classify with > 50 confidence => "other" with target_table_hint="skip"
- Only return target_table_hint=skip when truly unrouteable.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected classifier response type");
  }

  const parsed = extractJSON<HrDocumentClassification>(content.text);

  return {
    document_type: parsed.document_type || "other",
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 0,
    employee_name: parsed.employee_name || null,
    effective_date: parsed.effective_date || null,
    language: ["he", "en", "tl"].includes(parsed.language) ? parsed.language : "unknown",
    summary: parsed.summary || "",
    reasoning: parsed.reasoning || "",
    target_table_hint: parsed.target_table_hint || "skip",
  };
}
