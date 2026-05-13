# BACKLOG — Test coverage for `lib/operations/digest.ts` + `queries.ts`

**Raised by:** cmd 8 CI gate setup. When the 80% statement / 80% line /
80% function / 70% branch threshold went live on `lib/operations/*`,
three files were excluded from `collectCoverageFrom` to keep the gate
honest:

| File | Status | Why excluded |
|---|---|---|
| `lib/operations/draft-master-snapshot.ts` | Excluded permanently | 25-line Supabase wrapper. No branching logic. Same treatment as `lib/supabase/**`. |
| `lib/operations/digest.ts` | Excluded for now | 60 lines of digest text composition. Real logic. **No test suite yet.** |
| `lib/operations/queries.ts` | Excluded for now | 104 lines of read-side queries (dashboard stats, open issues filters). Real logic. **No test suite yet.** |
| `lib/operations/match-employee.ts` | Excluded for now | Phone normalization + name-to-employee matchers. Exercised indirectly via `promoteDraft` tests with mocks — direct coverage is ~19%. **Real test suite needed.** |

The third file from the original gap report — `lib/operations/process-chunk.ts`
— was orphaned by the Wings commit (`b101b52`) when bulk-import moved
to call `extractReportItems` + `promoteDraft` directly. **Deleted in
cmd 8.**

## Why deferred

Bringing `digest.ts` + `queries.ts` inside the gate is real work, not a
30-minute add:

- **`digest.ts`** — composes a human-readable daily-digest string from
  query results. Worth testing the composition (Hebrew + English
  variants, empty-list edge cases, day-boundary handling), but a
  decent test suite is 8-12 cases, ~1 hour.
- **`queries.ts`** — three different read shapes (dashboard stats,
  open issues by department, CEO action items). Each needs a real
  Postgres harness (the existing tests pattern). Probably 6-8
  integration cases, ~1.5 hours.
- **`match-employee.ts`** — `normalizePhone()`, `matchEmployeeByPhone()`,
  `matchEmployeeByName()`, `matchDepartmentByName()`,
  `matchProjectByName()`. Each needs a small fixture seed in
  `op_employees` / `op_departments` / `op_projects` and round-trip
  assertions. ~1 hour.

Both are in the path of the daily digest cron, so getting tests in
place is real value, not box-ticking. They didn't fit cmd 8's scope
(pre-launch quality gate) because the immediate goal was to **lock in
what we already have** before launch, not to expand coverage.

## Implementation sketch

1. Create `tests/digest.test.ts`:
   - Fixture: a small set of fake open issues + CEO items.
   - Assertions: rendered text contains expected counts, project names,
     and the localized header for both Hebrew and English.
   - Edge cases: zero issues, all-resolved, deadlines past today.

2. Create `tests/queries.test.ts` (real-PG integration, mirrors the
   pattern in `tests/drafts-lifecycle.test.ts`):
   - Seed a few rows in `op_reports`, `op_report_items`,
     `op_employees`, `op_projects`.
   - Call each exported query. Assert row counts + ordering.

3. Remove the `!lib/operations/digest.ts` and
   `!lib/operations/queries.ts` lines from `jest.config.js`. CI gate
   then enforces ≥80% / ≥70% on these files like everything else.

4. Update this backlog entry to "Closed in commit X".

## Acceptance criteria

- `lib/operations/digest.ts` ≥ 80% statements / 80% lines / 80%
  functions / 70% branches in CI coverage report.
- `lib/operations/queries.ts` same thresholds.
- `jest.config.js` no longer excludes them.
- CI continues to pass.

## Effort estimate

~2.5 hours total (digest 1 h + queries 1.5 h).

## Priority

Low. The gate's *current* promise — "files we test maintain 80%+
coverage" — is honest. These two files have logic the gate doesn't
yet cover, but they're stable and have lived under manual testing for
a few weeks. Lifting them under the gate is hygiene, not urgency.
