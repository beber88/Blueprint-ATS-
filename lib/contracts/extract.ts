import Anthropic from "@anthropic-ai/sdk";

export interface ContractExtraction {
  title: string;
  category: string;
  counterparty_name: string;
  counterparty_contact_name: string | null;
  counterparty_contact_email: string | null;
  counterparty_contact_phone: string | null;
  summary: string;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  is_renewable: boolean;
  obligations: { party: string; obligation: string; due_date?: string | null }[];
  warnings: string[];
  language: "he" | "en" | "tl" | "unknown";
}

const CATEGORIES = [
  "employment",
  "service",
  "supply",
  "subcontract",
  "lease",
  "nda",
  "consulting",
  "purchase",
  "other",
];

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}

function extractJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      /* fall through */
    }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as T;
  }
  throw new Error("Failed to extract JSON from contract extractor response");
}

/**
 * Extract structured contract fields + obligations + warnings from raw
 * pasted contract text. Used by /api/contracts/draft.
 */
export async function extractContractFields(rawText: string): Promise<ContractExtraction> {
  const truncated = rawText.length > 18000 ? rawText.slice(0, 18000) + "\n...[truncated]" : rawText;
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [
      {
        role: "user",
        content: `You are a senior contracts analyst at a construction company. Extract the structured fields from this contract text. The contract may be in Hebrew, English, or Tagalog (Filipino). Be precise with dates (return ISO YYYY-MM-DD) and money (numeric only, separately return currency code).

Categories to choose from: ${CATEGORIES.join(", ")}

Return ONLY valid JSON:
{
  "title": "short title (max 80 chars)",
  "category": "one of ${CATEGORIES.join(" | ")}",
  "counterparty_name": "the other party (company or person)",
  "counterparty_contact_name": "named individual at the counterparty, or null",
  "counterparty_contact_email": "email, or null",
  "counterparty_contact_phone": "phone, or null",
  "summary": "2-3 sentence summary of what this contract does",
  "signing_date": "YYYY-MM-DD or null",
  "effective_date": "YYYY-MM-DD or null",
  "expiration_date": "YYYY-MM-DD or null",
  "renewal_date": "YYYY-MM-DD if there is a renewal/notice deadline, else null",
  "monetary_value": number or null,
  "currency": "ISO 4217 code (USD, ILS, PHP, EUR...) or null",
  "is_renewable": boolean,
  "obligations": [
    { "party": "us|counterparty", "obligation": "what they must do", "due_date": "YYYY-MM-DD or null" }
  ],
  "warnings": ["any concerning clauses: auto-renewal, indemnity, exclusivity, IP assignment, harsh termination, etc."],
  "language": "he | en | tl | unknown"
}

Contract text:
${truncated}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected extractor response type");

  const parsed = extractJSON<ContractExtraction>(content.text);

  return {
    title: parsed.title || "Untitled contract",
    category: CATEGORIES.includes(parsed.category) ? parsed.category : "other",
    counterparty_name: parsed.counterparty_name || "Unknown",
    counterparty_contact_name: parsed.counterparty_contact_name || null,
    counterparty_contact_email: parsed.counterparty_contact_email || null,
    counterparty_contact_phone: parsed.counterparty_contact_phone || null,
    summary: parsed.summary || "",
    signing_date: parsed.signing_date || null,
    effective_date: parsed.effective_date || null,
    expiration_date: parsed.expiration_date || null,
    renewal_date: parsed.renewal_date || null,
    monetary_value: typeof parsed.monetary_value === "number" ? parsed.monetary_value : null,
    currency: parsed.currency || null,
    is_renewable: !!parsed.is_renewable,
    obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    language: ["he", "en", "tl"].includes(parsed.language) ? parsed.language : "unknown",
  };
}
