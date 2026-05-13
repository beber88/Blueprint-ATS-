# Preview & Drafts — Lifecycle

Every AI extraction in this system lands in `op_report_drafts` first. Real
`op_reports` rows are only created when a human (Preview UI) or an
auto-promote policy decides the draft is ready. This document explains the
contract.

## Tables involved

- `op_report_drafts` — the staging area. One row per AI extraction.
- `op_reports` — the real, query-able report. Created from a draft via Save
  or auto-promote.
- `op_report_items` — extracted line items, created alongside the report.
- `op_bulk_import_items` — bulk-import unit tracking; each item links to its
  draft via `op_report_drafts.bulk_import_item_id`.

## Draft status state machine

```
                         ┌─────────────┐
                         │   draft     │  ← created by /api/operations/intake/extract
                         └──────┬──────┘    or by the bulk worker
                                │
              ┌─────────────────┼────────────────────┐
              │                 │                    │
       saved (no flag)   flagged (Save & Flag)    discarded
              │                 │                    │
              ▼                 ▼                    ▼
       op_reports row     op_reports row    no op_reports row
       flagged=false      flagged=true       (audit-only)
```

| Status | Set by | Meaning |
|---|---|---|
| `draft` | extract endpoint / bulk worker | Fresh AI output, never saved. Editable. |
| `saved` | Save action / auto-promote | Promoted to `op_reports`. `saved_report_id` populated. |
| `flagged` | Save & Flag action / auto-promote-with-high-warnings | Promoted to `op_reports` with `flagged_for_review=true` OR: auto-promote was requested but high-severity warnings blocked promotion. |
| `discarded` | Discard action | Audit log only. No `op_reports` row was created. |

## Save endpoint contract

`POST /api/operations/drafts/:id/save` body `{ flagForReview?, force? }`:

- 404 if the draft doesn't exist.
- 409 if the draft is already `saved` or `discarded`.
- 409 with `{ highWarnings: N }` if the draft has any high-severity
  warnings and `force` is not set. The UI uses this to surface the
  confirmation dialog ("`N` high-severity warning(s). Save anyway?").
- 200 with `{ reportId, itemsCount, flagged }` on success.

On items-insert failure the report is rolled back so the operator can
retry cleanly.

## Warning catalog

Computed by `lib/operations/draft-warnings.ts` — pure, takes
(`ai_output`, `MasterDataSnapshot`) → `Warning[]`.

| Code | Severity | Field | Triggered when |
|---|---|---|---|
| `MISSING_DATE` | high | `report_date` | `report_date` absent or not YYYY-MM-DD |
| `DATE_OUT_OF_RANGE` | high | `report_date` | `report_date` < 2025-01-01 or > today+1 |
| `MISSING_PROJECT` | high | `project` | Neither `project_id` nor `project_name` at top level |
| `MISSING_SUMMARY` | medium | `summary` | No top-level summary AND zero items |
| `UNKNOWN_PROJECT` | high | `items[N].project` | Item references a project not in active `op_projects` |
| `UNKNOWN_EMPLOYEE` | medium | `items[N].person_responsible` | Item references a person not in active `op_employees` |
| `CEO_ACTIONS_MISMATCH` | medium | `items` / `ceo_action_items` | Top-level CEO section vs per-item flags inconsistent |
| `INVALID_ATTENDANCE_STATUS` | low | `items[N].attendance_status` | `category=attendance` but status outside {present,late,absent,awol,leave,off} |

Each warning carries a `field` path that the Preview UI uses to scroll to
the offending element (`items[N].*` matches an HTML id `field-items-N`).

## Auto-promote (bulk only)

Set `op_bulk_import_jobs.auto_promote = true` to let the worker promote
drafts without human review **only** when they have zero high-severity
warnings:

- `auto_promote = true` AND `warnings.some(severity === 'high') === false`
  → worker calls `promoteDraft()` → draft status `saved`, op_reports row
  created.
- `auto_promote = true` AND any high warning → draft status `flagged`,
  no op_reports row. Operator must review via the Drafts inbox.
- `auto_promote = false` (default) → draft stays as `draft` regardless of
  warnings. Operator must Save/Discard via the Preview UI.

The toggle in the Bulk Import UI shows a red confirmation:
> "This will save up to N reports without human review if they have no
> high-severity warnings. Recommended only for historical data you trust.
> Continue?"

## Drafts inbox

`/hr/operations/drafts` lists drafts in status `draft` or `flagged` by
default. Filters: status, source_kind (manual / bulk / retry),
severity-of-warnings. Click any row to open the Preview UI.

## FK behavior

| FK | Direction | ON DELETE |
|---|---|---|
| `op_report_drafts.saved_report_id` | → `op_reports(id)` | SET NULL |
| `op_report_drafts.bulk_import_item_id` | → `op_bulk_import_items(id)` | CASCADE |
| `op_reports.draft_source_id` | → `op_report_drafts(id)` | SET NULL |

Practical consequences:
- Deleting a bulk item cascades to its draft, but **not** to the report
  the draft promoted to. Reports stand on their own once created.
- Deleting a saved draft sets `op_reports.draft_source_id` to NULL — the
  report is preserved.
- Deleting a report sets `op_report_drafts.saved_report_id` to NULL —
  the draft row stays as an audit record.

## Source kinds

| `source_kind` | Where drafts come from |
|---|---|
| `manual` | Single-intake page → `/api/operations/intake/extract` |
| `bulk` | Bulk-import worker, one draft per chunk |
| `retry` | Future: re-extraction of a previously failed bulk item (commit-3+ territory) |
