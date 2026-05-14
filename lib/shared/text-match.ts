// Shared text-matching utilities used by every "warning catalog" module
// (operations drafts, contracts drafts, future modules).
//
// All exports are PURE — deterministic, no I/O. The module-private versions
// originally lived in `lib/operations/draft-warnings.ts`; they were extracted
// here in the contracts-module work so a second consumer (the contracts
// warnings catalog) could reuse them without duplication.
//
// Behavior is BYTE-IDENTICAL to the pre-refactor operations matcher. The
// existing operations tests in tests/draft-warnings.test.ts must continue
// to pass unchanged — that's the contract this refactor enforces.

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
export function canonicalize(s: string | null | undefined): string {
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
export const MATCHER_STOPWORDS = new Set([
  "project", "projects", "building", "buildings", "site", "phase",
  "works", "work", "the", "and", "of", "for", "in", "at", "to",
]);

/**
 * Tokenizes a name for the matcher. Drops tokens shorter than 2
 * characters (single letters / digits are too noisy — "4" in "4-Storey"
 * matches every numbered project; "S." in "Christian S. Mendevil" is a
 * middle initial) and drops construction-domain stopwords.
 */
export function tokens(s: string | null | undefined): Set<string> {
  return new Set(
    canonicalize(s)
      .split(" ")
      .filter((t) => t.length >= 2 && !MATCHER_STOPWORDS.has(t))
  );
}

/**
 * Master-data matcher used by UNKNOWN_PROJECT + UNKNOWN_EMPLOYEE rules
 * (operations) and UNKNOWN_COUNTERPARTY / PROJECT_NOT_FOUND (contracts).
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
export function isKnownName(
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
