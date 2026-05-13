// computeWarnings — pure function that turns an AI extraction + a
// snapshot of master data (active projects + active employees) into a
// catalog of warnings. Used by the draft pipeline to surface review
// candidates without blocking save.
//
// Pure / deterministic / no side effects so it can be unit-tested without
// any database. Each rule is independent — failing one never short-circuits
// the others.

export type Severity = "low" | "medium" | "high";

export type WarningCode =
  | "MISSING_DATE"
  | "MISSING_PROJECT"
  | "MISSING_SUMMARY"
  | "UNKNOWN_PROJECT"
  | "UNKNOWN_EMPLOYEE"
  | "DATE_OUT_OF_RANGE"
  | "CEO_ACTIONS_MISMATCH"
  | "INVALID_ATTENDANCE_STATUS";

export interface Warning {
  code: WarningCode;
  severity: Severity;
  field: string;           // dotted path into ai_output, used by the UI to scroll
  message_en: string;
  message_he: string;
}

// Subset of the AI extraction the warnings logic needs to see. The full
// ai_output_json may carry more fields; computeWarnings ignores them.
export interface AiOutput {
  report_date?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  summary?: string | null;
  items?: AiItem[];
  ceo_action_items?: unknown[] | null;
}

export interface AiItem {
  project?: string | null;            // raw project name as the AI saw it
  department?: string | null;
  person_responsible?: string | null;
  issue?: string;
  category?: string | null;
  ceo_decision_needed?: boolean | null;
  attendance_status?: string | null;
}

export interface MasterDataSnapshot {
  activeProjects: Array<{ id: string; name: string }>;
  activeEmployees: Array<{ id: string; full_name: string }>;
}

const VALID_ATTENDANCE_STATUSES = new Set([
  "present", "late", "absent", "awol", "leave", "off",
]);

const DATE_LOWER_BOUND = "2025-01-01";

function normalize(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim();
}

function todayPlusOne(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isKnownName(
  name: string | null | undefined,
  haystack: Array<{ full_name?: string; name?: string }>
): boolean {
  const n = normalize(name);
  if (!n) return false;
  return haystack.some((h) => {
    const candidate = normalize(h.full_name || h.name || "");
    if (!candidate) return false;
    // Match by substring in either direction so "Eric" matches
    // "Eric (Enrique Masangkay)" and vice versa.
    return candidate === n || candidate.includes(n) || n.includes(candidate);
  });
}

export function computeWarnings(
  ai: AiOutput,
  snapshot: MasterDataSnapshot
): Warning[] {
  const out: Warning[] = [];

  // 1. MISSING_DATE
  if (!ai.report_date || !/^\d{4}-\d{2}-\d{2}$/.test(ai.report_date)) {
    out.push({
      code: "MISSING_DATE",
      severity: "high",
      field: "report_date",
      message_en: "Report date is missing or not in YYYY-MM-DD format.",
      message_he: "תאריך הדוח חסר או לא בפורמט YYYY-MM-DD.",
    });
  }

  // 6. DATE_OUT_OF_RANGE (only when the date IS present and valid)
  if (ai.report_date && /^\d{4}-\d{2}-\d{2}$/.test(ai.report_date)) {
    const upper = todayPlusOne();
    if (ai.report_date < DATE_LOWER_BOUND || ai.report_date > upper) {
      out.push({
        code: "DATE_OUT_OF_RANGE",
        severity: "high",
        field: "report_date",
        message_en: `Report date ${ai.report_date} is outside the expected range (${DATE_LOWER_BOUND} to ${upper}).`,
        message_he: `תאריך הדוח ${ai.report_date} מחוץ לטווח הצפוי (${DATE_LOWER_BOUND} עד ${upper}).`,
      });
    }
  }

  // 2. MISSING_PROJECT — neither id nor name set at the top level.
  if (!ai.project_id && !ai.project_name) {
    out.push({
      code: "MISSING_PROJECT",
      severity: "high",
      field: "project",
      message_en: "No project was associated with this report.",
      message_he: "לא שויך פרויקט לדוח זה.",
    });
  }

  // 3. MISSING_SUMMARY — no top-level summary and no items.
  const itemsCount = (ai.items || []).length;
  const hasSummary = !!(ai.summary && ai.summary.trim().length > 0);
  if (!hasSummary && itemsCount === 0) {
    out.push({
      code: "MISSING_SUMMARY",
      severity: "medium",
      field: "summary",
      message_en: "Report has no summary and no extracted items.",
      message_he: "לדוח אין תקציר ולא נמצאו פריטים.",
    });
  }

  // 4. UNKNOWN_PROJECT — any item references a project name not in active list.
  if (ai.items) {
    ai.items.forEach((it, i) => {
      if (it.project && !isKnownName(it.project, snapshot.activeProjects)) {
        out.push({
          code: "UNKNOWN_PROJECT",
          severity: "high",
          field: `items[${i}].project`,
          message_en: `Project "${it.project}" is not in the active project roster.`,
          message_he: `הפרויקט "${it.project}" אינו ברשימת הפרויקטים הפעילים.`,
        });
      }
    });
  }

  // 5. UNKNOWN_EMPLOYEE — any item references a person not in active employees.
  if (ai.items) {
    ai.items.forEach((it, i) => {
      if (
        it.person_responsible &&
        !isKnownName(it.person_responsible, snapshot.activeEmployees)
      ) {
        out.push({
          code: "UNKNOWN_EMPLOYEE",
          severity: "medium",
          field: `items[${i}].person_responsible`,
          message_en: `Employee "${it.person_responsible}" is not in the active roster.`,
          message_he: `העובד "${it.person_responsible}" אינו ברשימת העובדים הפעילים.`,
        });
      }
    });
  }

  // 7. CEO_ACTIONS_MISMATCH — top-level CEO actions present but no item
  //    has ceo_decision_needed=true, or vice versa.
  const hasCeoSection =
    Array.isArray(ai.ceo_action_items) && ai.ceo_action_items.length > 0;
  const hasCeoFlag = (ai.items || []).some((it) => it.ceo_decision_needed === true);
  if (hasCeoSection !== hasCeoFlag) {
    out.push({
      code: "CEO_ACTIONS_MISMATCH",
      severity: "medium",
      field: hasCeoSection ? "items" : "ceo_action_items",
      message_en:
        "CEO Action Items section and per-item `ceo_decision_needed` flags are inconsistent.",
      message_he:
        "סעיף 'החלטות מנכ\"ל' לא תואם לדגלי ceo_decision_needed ברמת הפריט.",
    });
  }

  // 8. INVALID_ATTENDANCE_STATUS — only for items in attendance category.
  if (ai.items) {
    ai.items.forEach((it, i) => {
      if (
        it.category === "attendance" &&
        it.attendance_status &&
        !VALID_ATTENDANCE_STATUSES.has(normalize(it.attendance_status))
      ) {
        out.push({
          code: "INVALID_ATTENDANCE_STATUS",
          severity: "low",
          field: `items[${i}].attendance_status`,
          message_en: `Attendance status "${it.attendance_status}" is outside the known set (present, late, absent, awol, leave, off).`,
          message_he: `סטטוס נוכחות "${it.attendance_status}" מחוץ לערכים המוכרים (present, late, absent, awol, leave, off).`,
        });
      }
    });
  }

  return out;
}
