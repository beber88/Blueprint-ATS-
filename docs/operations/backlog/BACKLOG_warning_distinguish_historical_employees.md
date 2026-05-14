# BACKLOG — Distinguish "historical" from "unknown" employees in warnings

**Raised by:** verification finding in cmd 7 A3 (real seed-quality signal).
**Priority:** medium. Not blocking go-live, but the current behavior hides
useful information from operators.

**Status (2026-05-13):** punctuation canonicalization + token-set matching
with construction-domain stopwords landed separately (see commit
`fix(warnings): token-set matcher with construction-domain stopwords`).
Those changes do NOT address this backlog item — the historical / active
distinction is still the outstanding work described below.

## Problem

Today, `computeWarnings` emits `UNKNOWN_EMPLOYEE` whenever a name in the
extracted items doesn't match an entry in `op_employees WHERE is_active=true`.
This conflates two different operator-facing situations:

1. **Truly unknown** — name nowhere in the system. Possible AI hallucination,
   typo in the source report, or a new hire whose record hasn't been added.
   Action: investigate or add to roster.
2. **Historical (separated)** — name appears in `op_employees_history`. The
   report references someone who left the company. This is a strong signal
   that **the report itself is old / out of date** (e.g. a backlog import).
   Action: confirm the report's date is correct; the employee reference is
   not actionable.

Cmd 7 A3 surfaced this concretely: "Adrian" matches a separated employee in
`samples/operations/employees_status.json` (`resigned 2025-09-30`), but the
warning treats him identically to a name that doesn't exist anywhere.

## Proposed warning catalog change

Split the single `UNKNOWN_EMPLOYEE` code into two codes:

| code | severity | meaning | operator action |
|---|---|---|---|
| `UNKNOWN_EMPLOYEE` | medium | Name nowhere in active OR history rosters | Investigate / add to roster |
| `HISTORICAL_EMPLOYEE` | low | Name found in `op_employees_history` | Likely a stale report — verify `report_date` |

`HISTORICAL_EMPLOYEE` is severity=low because it doesn't block the work —
the report just references someone who's gone. `UNKNOWN_EMPLOYEE` stays
medium.

## Implementation sketch

- `MasterDataSnapshot` gains a third field: `historicalEmployees:
  Array<{ id, full_name, separation_date }>`. Loaded in
  `lib/operations/draft-master-snapshot.ts`.
- `computeWarnings` checks `historicalEmployees` BEFORE emitting
  `UNKNOWN_EMPLOYEE`. If the name matches a historical row, emit
  `HISTORICAL_EMPLOYEE` instead.
- Same pattern applies to `UNKNOWN_PROJECT` — but for projects we already
  have `op_projects.status IN ('active','paused','completed')`. A paused or
  completed project showing up in a current report is the project-equivalent
  of historical. The warning split is `UNKNOWN_PROJECT` (severity=high) vs
  `INACTIVE_PROJECT` (severity=low).
- Preview UI: show the separation date / project status in the warning
  message so operators see "Adrian (separated 2025-09-30)" inline.

## Estimated effort

- Pure logic + tests: 1.5 hours.
- Master snapshot helper: 30 min.
- UI message tweak: 15 min.
- Translations (he/en/tl): 15 min.

**Total: ~2.5 hours.**

## Acceptance criteria

1. New unit tests in `tests/draft-warnings.test.ts`:
   - Name in active roster → no warning.
   - Name in history only → `HISTORICAL_EMPLOYEE` (low), message includes
     separation date.
   - Name nowhere → `UNKNOWN_EMPLOYEE` (medium), message says "not in the
     roster".
   - Same three cases for projects (active / paused / nowhere).
2. The Preview UI severity sidebar shows the new code with the historical
   metadata in the message body.
3. Existing tests still pass — `UNKNOWN_EMPLOYEE` semantics narrow but
   don't break.

## Why not do it now?

Cmd 4 + cmd 7 already broke the work into Spine + Wings + Gate. Adding a
fourth scope to cmd 7 is exactly the kind of feature creep the user
explicitly pushed back on. This is real and worth doing — but it earns
its own cmd in the next cycle, after staging surfaces whatever else.
