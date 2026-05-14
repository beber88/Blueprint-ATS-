// Public type surface for the Contracts module. Kept in one file so
// every consumer (extractor, warnings, promote, queries, API routes, UI)
// imports from one place — no drift between server and client shapes.

export type ContractCategory = "customer" | "subcontractor" | "vendor";

export type ContractStatus =
  | "draft"
  | "active"
  | "expired"
  | "terminated"
  | "renewed";

export type ContractAlertType =
  | "expiring_soon"
  | "expired"
  | "renewal_window_open"
  | "payment_milestone_due";

export type Severity = "low" | "medium" | "high" | "urgent";

// What Claude returns from extract-contract.ts.
export interface ExtractedContract {
  category: ContractCategory | null;
  title: string | null;
  counterparty_name: string | null;
  counterparty_contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  project_hint: string | null;
  signing_date: string | null;       // YYYY-MM-DD
  effective_date: string | null;     // YYYY-MM-DD
  expiration_date: string | null;    // YYYY-MM-DD
  renewal_date: string | null;       // YYYY-MM-DD
  is_renewable: boolean;
  monetary_value: number | null;
  currency: string | null;           // ISO-3
  summary: string | null;            // ≤ 300 chars
  confidence: number;                // 0..1
  notes: string | null;
}

// Master-data lookups used by the warning catalog.
export interface ContractSnapshot {
  activeProjects: Array<{ id: string; name: string }>;
  knownCounterparties: Array<{ name: string }>;
}

// Warning shape — identical shape to operations warnings so the Preview UI
// can render either module's catalog with no per-module branching.
export type ContractWarningCode =
  | "MISSING_COUNTERPARTY"
  | "MISSING_EXPIRATION"
  | "EFFECTIVE_AFTER_EXPIRATION"
  | "MISSING_MONETARY_VALUE"
  | "MONETARY_VALUE_UNUSUAL"
  | "COUNTERPARTY_NOT_IN_ROSTER"
  | "PROJECT_NOT_FOUND";

export interface ContractWarning {
  code: ContractWarningCode;
  severity: Exclude<Severity, "urgent">;   // contracts use low/medium/high
  field: string;
  message_en: string;
  message_he: string;
}

// Full draft row as stored in ct_contract_drafts.
export interface ContractDraftRow {
  id: string;
  source_text: string;
  ai_output_json: ExtractedContract & {
    storage_path?: string | null;       // populated when intake uploaded a PDF
  };
  warnings_json: ContractWarning[];
  status: "draft" | "saved" | "flagged" | "discarded";
  source_kind: "manual" | "bulk" | "retry";
  saved_contract_id: string | null;
  created_at: string;
  updated_at: string;
}

// Output of contract-promote.ts.
export interface ContractPromoteResult {
  contractId: string;
  category: ContractCategory;
}
