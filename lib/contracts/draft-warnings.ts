// computeContractWarnings — pure deterministic function. Same shape as
// lib/operations/draft-warnings.ts. No I/O, fully unit-testable without
// a database. Each rule is independent; failing one never short-circuits
// the others.

import { isKnownName } from "@/lib/shared/text-match";
import type {
  ExtractedContract,
  ContractSnapshot,
  ContractWarning,
} from "./types";

// Currencies we recognize. Everything else passes through but doesn't
// participate in MONETARY_VALUE_UNUSUAL bounds (the bounds are roughly
// PHP-scale; bigger values are flagged regardless of currency).
const HIGH_VALUE_THRESHOLD = 10_000_000;

export function computeContractWarnings(
  ai: ExtractedContract,
  snapshot: ContractSnapshot
): ContractWarning[] {
  const out: ContractWarning[] = [];

  // 1. MISSING_COUNTERPARTY
  if (!ai.counterparty_name || ai.counterparty_name.trim() === "") {
    out.push({
      code: "MISSING_COUNTERPARTY",
      severity: "high",
      field: "counterparty_name",
      message_en: "Counterparty name is missing — the other signatory must be identified.",
      message_he: "שם הצד הנגדי חסר — חובה לזהות את הצד החותם השני.",
    });
  }

  // 2. MISSING_EXPIRATION — only matters if not renewable.
  if (!ai.expiration_date && !ai.is_renewable) {
    out.push({
      code: "MISSING_EXPIRATION",
      severity: "high",
      field: "expiration_date",
      message_en: "Expiration date is missing and the contract is not marked renewable.",
      message_he: "תאריך תפוגה חסר והחוזה לא מסומן כמתחדש.",
    });
  }

  // 3. EFFECTIVE_AFTER_EXPIRATION — sanity check.
  if (ai.effective_date && ai.expiration_date && ai.effective_date > ai.expiration_date) {
    out.push({
      code: "EFFECTIVE_AFTER_EXPIRATION",
      severity: "high",
      field: "expiration_date",
      message_en: `Effective date ${ai.effective_date} is after expiration date ${ai.expiration_date}.`,
      message_he: `תאריך תחילה ${ai.effective_date} מאוחר מתאריך תפוגה ${ai.expiration_date}.`,
    });
  }

  // 4. MISSING_MONETARY_VALUE — for paid contracts only.
  if (
    ai.monetary_value === null &&
    (ai.category === "customer" || ai.category === "subcontractor")
  ) {
    out.push({
      code: "MISSING_MONETARY_VALUE",
      severity: "medium",
      field: "monetary_value",
      message_en: "Monetary value is missing for a paid contract.",
      message_he: "ערך כספי חסר עבור חוזה בתשלום.",
    });
  }

  // 5. MONETARY_VALUE_UNUSUAL — bounds check.
  if (
    ai.monetary_value !== null &&
    (ai.monetary_value > HIGH_VALUE_THRESHOLD || ai.monetary_value < 0)
  ) {
    out.push({
      code: "MONETARY_VALUE_UNUSUAL",
      severity: "low",
      field: "monetary_value",
      message_en: `Monetary value ${ai.monetary_value} is outside the expected range — verify currency and decimal placement.`,
      message_he: `ערך כספי ${ai.monetary_value} מחוץ לטווח הצפוי — אמת מטבע ומיקום נקודה עשרונית.`,
    });
  }

  // 6. COUNTERPARTY_NOT_IN_ROSTER — fuzzy match via shared text-match.
  // Only fires when we HAVE a counterparty name (else MISSING_COUNTERPARTY
  // already covers it).
  if (
    ai.counterparty_name &&
    ai.counterparty_name.trim() !== "" &&
    snapshot.knownCounterparties.length > 0 &&
    !isKnownName(ai.counterparty_name, snapshot.knownCounterparties)
  ) {
    out.push({
      code: "COUNTERPARTY_NOT_IN_ROSTER",
      severity: "medium",
      field: "counterparty_name",
      message_en: `Counterparty "${ai.counterparty_name}" is not in the recent contracts roster — verify the name spelling or this is a new party.`,
      message_he: `הצד הנגדי "${ai.counterparty_name}" לא ברשימת הצדדים מהחוזים האחרונים — אמת איות שם או שמדובר בצד חדש.`,
    });
  }

  // 7. PROJECT_NOT_FOUND — fuzzy match against active op_projects.
  if (
    ai.project_hint &&
    ai.project_hint.trim() !== "" &&
    !isKnownName(ai.project_hint, snapshot.activeProjects)
  ) {
    out.push({
      code: "PROJECT_NOT_FOUND",
      severity: "medium",
      field: "project_hint",
      message_en: `Referenced project "${ai.project_hint}" was not found in the active projects roster.`,
      message_he: `הפרויקט "${ai.project_hint}" אינו ברשימת הפרויקטים הפעילים.`,
    });
  }

  return out;
}
