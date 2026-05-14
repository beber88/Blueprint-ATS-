import type { SupabaseClient } from "@supabase/supabase-js";
import { isKnownName } from "@/lib/shared/text-match";
import type {
  ContractCategory,
  ContractDraftRow,
  ContractPromoteResult,
  ContractStatus,
  ExtractedContract,
} from "./types";

// Defense in depth: mirror the CHECK constraints in migration 008. A
// hand-edited draft (via the PATCH endpoint) could try to smuggle an
// invalid value the schema would reject at insert; normalize here
// instead of letting the DB throw a 23514 constraint violation.
const VALID_CATEGORIES = new Set<ContractCategory>(["customer", "subcontractor", "vendor"]);
const VALID_STATUSES = new Set<ContractStatus>(["draft", "active", "expired", "terminated", "renewed"]);
const ISO3 = /^[A-Z]{3}$/;

function pickCategory(value: unknown, fallback: ContractCategory): ContractCategory {
  return typeof value === "string" && VALID_CATEGORIES.has(value as ContractCategory)
    ? (value as ContractCategory)
    : fallback;
}

function pickStatus(value: unknown, fallback: ContractStatus): ContractStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as ContractStatus)
    ? (value as ContractStatus)
    : fallback;
}

function pickCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const up = value.toUpperCase().trim();
  return ISO3.test(up) ? up : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// Resolve `project_hint` to an op_projects.id by fuzzy match against the
// active roster. Returns null when no clear match. Reuses the same
// text-match utilities as the warning catalog so behavior is consistent.
async function resolveProjectId(
  supabase: SupabaseClient,
  hint: string | null
): Promise<string | null> {
  if (!hint || hint.trim() === "") return null;
  const { data: projects } = await supabase
    .from("op_projects")
    .select("id, name")
    .eq("status", "active");
  const haystack = (projects || []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
  }));
  if (haystack.length === 0) return null;
  // isKnownName tells us whether ANY haystack entry matches. To get the
  // specific id, iterate and find the first one that returns a hit when
  // tested in isolation.
  for (const candidate of haystack) {
    if (isKnownName(hint, [candidate])) return candidate.id;
  }
  return null;
}

interface PromoteOptions {
  flagForReview?: boolean;
  // When the intake uploaded a PDF, the storage path is recorded on the
  // ai_output_json. Pass it through to ct_contracts.storage_path.
  storagePath?: string | null;
}

// Promotes a draft (read from ct_contract_drafts) to a real ct_contracts
// row. Used by:
//   - POST /api/contracts/drafts/:id/save (manual approve)
//   - (round 2) bulk-auto-promote worker
//
// Throws on hard DB errors. The caller (the Save route) maps to a 500.
export async function promoteContract(
  supabase: SupabaseClient,
  draft: ContractDraftRow,
  opts: PromoteOptions = {}
): Promise<ContractPromoteResult> {
  const ai: ExtractedContract = draft.ai_output_json;

  const category = pickCategory(ai.category, "vendor");
  const status = pickStatus("active", "active"); // newly-promoted contracts start as active
  const projectId = await resolveProjectId(supabase, ai.project_hint);

  // Sanitize / normalize before insert.
  const title = (ai.title && ai.title.trim()) || "Untitled contract";
  const counterpartyName = (ai.counterparty_name && ai.counterparty_name.trim()) || "Unknown";

  const { data: row, error } = await supabase
    .from("ct_contracts")
    .insert({
      category,
      counterparty_name: counterpartyName,
      counterparty_contact_name: ai.counterparty_contact?.name || null,
      counterparty_contact_email: ai.counterparty_contact?.email || null,
      counterparty_contact_phone: ai.counterparty_contact?.phone || null,
      project_id: projectId,
      title,
      summary: ai.summary || null,
      signing_date: isoDate(ai.signing_date),
      effective_date: isoDate(ai.effective_date),
      expiration_date: isoDate(ai.expiration_date),
      renewal_date: isoDate(ai.renewal_date),
      monetary_value: typeof ai.monetary_value === "number" ? ai.monetary_value : null,
      currency: pickCurrency(ai.currency),
      is_renewable: !!ai.is_renewable,
      status,
      storage_path: opts.storagePath ?? null,
      // obligations_json reserved for round 2 — leave at DEFAULT '[]'
      flagged_for_review: !!opts.flagForReview,
      draft_source_id: draft.id,
    })
    .select("id, category")
    .single();

  if (error || !row) {
    throw new Error(`failed to create ct_contracts row: ${error?.message || "unknown error"}`);
  }

  // Flip the draft to saved + link back.
  await supabase
    .from("ct_contract_drafts")
    .update({
      status: opts.flagForReview ? "flagged" : "saved",
      saved_contract_id: row.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  return {
    contractId: row.id as string,
    category: row.category as ContractCategory,
  };
}
