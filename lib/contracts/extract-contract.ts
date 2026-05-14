import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedContract } from "./types";

// Spine extractor: metadata only. Obligations checklist is DELIBERATELY
// out of scope for round 1 — the obligations_json column in ct_contracts
// is reserved for round 2 (see plan §Round 2 #1).

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Claude AI is not configured. Missing ANTHROPIC_API_KEY.");
  }
  return new Anthropic({ apiKey });
}

function extractJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // fall through
  }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // fall through
    }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // fall through
    }
  }
  throw new Error("Failed to extract JSON from Claude response");
}

const SYSTEM_PROMPT = `You are a contract-metadata extractor for Blueprint Building Group Inc.
Read the contract text and return ONLY a single JSON object matching the
schema below. DO NOT extract obligations, payment schedules, milestones,
or task lists — those are out of scope for this version.

Schema:
{
  "category": "customer" | "subcontractor" | "vendor" | null,
  "title": string | null,
  "counterparty_name": string | null,
  "counterparty_contact": {
    "name": string | null,
    "email": string | null,
    "phone": string | null
  },
  "project_hint": string | null,
  "signing_date": "YYYY-MM-DD" | null,
  "effective_date": "YYYY-MM-DD" | null,
  "expiration_date": "YYYY-MM-DD" | null,
  "renewal_date": "YYYY-MM-DD" | null,
  "is_renewable": boolean,
  "monetary_value": number | null,
  "currency": "ILS" | "USD" | "PHP" | "EUR" | null,
  "summary": string,
  "confidence": number,
  "notes": string | null
}

Field rules:
- category: "customer" when Blueprint is the contractor/service provider
  being paid; "subcontractor" when a third party is being hired by us
  to do work; "vendor" when a third party is supplying goods/materials.
  Null if ambiguous.
- counterparty_name: the OTHER party (NOT Blueprint).
- project_hint: short project name as it appears in the contract, if any.
  Used downstream to match against op_projects.
- All dates ISO YYYY-MM-DD. Null when not present.
- is_renewable: true ONLY if the contract has an explicit renewal clause.
- monetary_value: total contract value as a number (no commas, no symbol).
  Null if absent or non-numeric.
- currency: 3-letter ISO. Null if absent.
- summary: at most 300 characters.
- confidence: realistic 0.0..1.0. 0.5 means "I had to guess fields".
- notes: anything important the operator should see that doesn't fit
  another field (e.g. unusual indemnification, governing-law surprise).
  Keep under 200 chars. Null when nothing to say.

Return ONLY the JSON object, no prose, no markdown fence.`;

interface ExtractOptions {
  model?: string;
  maxTokens?: number;
}

export async function extractContract(
  text: string,
  opts: ExtractOptions = {}
): Promise<ExtractedContract> {
  const client = getAnthropicClient();
  const truncated =
    text.length > 30_000 ? text.slice(0, 30_000) + "\n...[truncated]" : text;

  const message = await client.messages.create({
    model: opts.model || "claude-sonnet-4-20250514",
    max_tokens: opts.maxTokens || 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: truncated }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text block");
  }

  const parsed = extractJSON<Partial<ExtractedContract>>(block.text);

  // Defensive defaults — Claude may omit fields. Schema-shape guaranteed
  // regardless so downstream code never crashes on undefined.
  return {
    category: (parsed.category ?? null) as ExtractedContract["category"],
    title: parsed.title ?? null,
    counterparty_name: parsed.counterparty_name ?? null,
    counterparty_contact: {
      name: parsed.counterparty_contact?.name ?? null,
      email: parsed.counterparty_contact?.email ?? null,
      phone: parsed.counterparty_contact?.phone ?? null,
    },
    project_hint: parsed.project_hint ?? null,
    signing_date: parsed.signing_date ?? null,
    effective_date: parsed.effective_date ?? null,
    expiration_date: parsed.expiration_date ?? null,
    renewal_date: parsed.renewal_date ?? null,
    is_renewable: !!parsed.is_renewable,
    monetary_value:
      typeof parsed.monetary_value === "number" ? parsed.monetary_value : null,
    currency: parsed.currency ?? null,
    summary: parsed.summary ?? null,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0,
    notes: parsed.notes ?? null,
  };
}
