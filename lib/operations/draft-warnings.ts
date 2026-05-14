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

/**
 * Canonical form used by the master-data matcher. Reduces the noise that
 * comes from PMs writing the same project / person multiple ways in free
 * text — "4 Storey" vs "4-Storey" vs "4-storey project" — so the matcher
 * can compare without firing false UNKNOWN_PROJECT / UNKNOWN_EMPLOYEE
 * warnings.
 *
 * What this function changes:
 *  - lowercases the string
 *  - trims surrounding whitespace
 *  - replaces hyphen, underscore, dot, slash, backslash, comma, colon,
 *    semicolon, parentheses with a single space (the common separators
 *    PMs use). Parens are stripped so "Marie Cris Millete (MC)" gets
 *    split into the tokens {marie, cris, millete, mc} rather than
 *    "(mc)" living as its own token.
 *  - collapses any run of whitespace to one space
 *
 * What this function deliberately does NOT change:
 *  - apostrophes (`'`) — preserved so "D'Souza" stays "d'souza", not
 *    "d souza"
 *  - non-ASCII characters — Hebrew, accented Latin, CJK pass through
 *    unchanged. Master data may store names in their native form;
 *    transliteration is not this function's job.
 *
 * For the broader matcher work (distinguishing historical from
 * never-existed employees), see
 * `docs/operations/backlog/BACKLOG_warning_distinguish_historical_employees.md`.
 */
function canonicalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .replace(/[-_./\\,:;()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construction-domain stopwords filtered out of the token-set matcher.
 * These appear in free-text descriptions of projects and people so often
 * that leaving them in would either:
 *  - produce false positives ("Storey Spa Project" would match
 *    "4-Storey Pampanga" via the shared word "project"), or
 *  - produce false negatives ("4-storey project" would not match
 *    "4-Storey Pampanga" because the trailing "project" token isn't on
 *    the master side — same shape).
 *
 * Keep this list SHORT (current target: ≤15 entries) and English-only.
 * PMs at Blueprint write reports in English even when speaking
 * Hebrew/Tagalog; we add HE/TL stopwords only when staging data shows
 * the need.
 *
 * Updating the list: when verification or staging surfaces a false
 * positive / negative, add the word here AND note the trigger case in
 * `docs/operations/preview-and-drafts.md` under "Warning catalog". The
 * doc is the single source of truth for the feedback loop.
 */
const MATCHER_STOPWORDS = new Set([
  "project", "projects", "building", "buildings", "site", "phase",
  "works", "work", "the", "and", "of", "for", "in", "at", "to",
]);

/**
 * Tokenizes a name for the matcher. Drops tokens shorter than 2
 * characters (single letters / digits are too noisy — "4" in "4-Storey"
 * matches every numbered project; "S." in "Christian S. Mendevil" is a
 * middle initial) and drops construction-domain stopwords.
 */
function tokens(s: string | null | undefined): Set<string> {
  return new Set(
    canonicalize(s)
      .split(" ")
      .filter((t) => t.length >= 2 && !MATCHER_STOPWORDS.has(t))
  );
}

function todayPlusOne(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Master-data matcher used by UNKNOWN_PROJECT + UNKNOWN_EMPLOYEE rules.
 *
 * Two-tier matching:
 *  1. Token-set: extract `tokens()` from both sides; if both non-empty,
 *     match when every token of the smaller side appears in the larger
 *     side. This handles word reordering ("Mendevil/Christian" matches
 *     "Christian S. Mendevil"), middle initials ("John S Smith" matches
 *     "John Smith"), and trailing context words ("4-storey project"
 *     matches "4-Storey Pampanga" via the stopword filter).
 *  2. Substring fallback on the canonicalized form: catches single-token
 *     names with parens — "Eric" inside "Eric (Enrique Masangkay)" —
 *     and the case where one side is entirely filtered away by length
 *     or stopwords.
 *
 * Token-set is the primary because it handles word-order variance.
 * Substring is the safety net for the patterns the existing matcher
 * already handled correctly.
 */
function isKnownName(
  name: string | null | undefined,
  haystack: Array<{ full_name?: string; name?: string }>
): boolean {
  const nCanon = canonicalize(name);
  if (!nCanon) return false;
  const nTokens = tokens(name);
  return haystack.some((h) => {
    const raw = h.full_name || h.name || "";
    const cCanon = canonicalize(raw);
    if (!cCanon) return false;
    const cTokens = tokens(raw);
    // Tier 1: token-set match (only when both sides have something to
    // compare — empty side falls through to substring).
    if (nTokens.size > 0 && cTokens.size > 0) {
      const [small, big] =
        nTokens.size <= cTokens.size ? [nTokens, cTokens] : [cTokens, nTokens];
      let allIn = true;
      small.forEach((tok) => {
        if (!big.has(tok)) allIn = false;
      });
      if (allIn) return true;
    }
    // Tier 2: substring on canonicalized form.
    return cCanon === nCanon || cCanon.includes(nCanon) || nCanon.includes(cCanon);
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
