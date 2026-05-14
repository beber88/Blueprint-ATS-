# Operations Migrations

| # | File | Re-runnable | Depends on | Notes |
|---|------|-------------|------------|-------|
| 001 | `001_initial_schema.sql` | **No** | — | Recruitment tables + `cvs` storage bucket. Contains `CREATE POLICY` (no `IF NOT EXISTS` in Postgres) and `INSERT INTO storage.buckets` without conflict target. Apply once on initial setup. |
| 002 | `002_operations_intelligence.sql` | **No** | 001 | Full operations schema (`op_*` tables, views, indexes), `operations-reports` bucket, RLS. Contains 16 `CREATE POLICY` statements. Apply once. |
| 003 | `003_operations_seed_real_data.sql` | **Yes** | 002 | Seeds 11 departments, 31 projects, 27 active employees. Uses `ON CONFLICT (code) DO UPDATE` for departments/projects and `WHERE NOT EXISTS` for employees. Pre-flight `DO $$` block conditionally adds the global `op_employees_full_name_key` UNIQUE only if no partial unique index from 005 exists. |
| 004 | `004_operations_employees_history.sql` | **Yes** | 002 | Creates `op_employees_history`, seeds 14 historical separations + 1 transfer. Conditional UNIQUE on `full_name`, conditional RLS policies via `DO $$` blocks. |
| 005 | `005_operations_employee_lifecycle.sql` | **Yes** | 002, 003, 004 | (A) Sets `op_employees.is_active` NOT NULL. (B) Adds partial unique index `op_employees_active_full_name_uidx` then drops global UNIQUE. (C) Adds `op_employees_history.employee_id` FK with `ON DELETE SET NULL`. See `docs/operations/employee-lifecycle.md`. |
| 006 | `006_operations_bulk_import_jobs.sql` | **Yes** | 002 | Creates `op_bulk_import_jobs` + `op_bulk_import_items` for tracked bulk-import runs with cancel/resume/dedup. See `docs/operations/bulk-import.md`. |
| 007 | `007_operations_drafts.sql` | **Yes** | 002, 006 | Creates `op_report_drafts` (the preview-before-save staging table). Adds `op_reports.flagged_for_review`, `op_reports.draft_source_id` (FK → drafts, ON DELETE SET NULL), `op_bulk_import_jobs.auto_promote`. See `docs/operations/preview-and-drafts.md`. |

## Apply order

```
001 → 002 → 003 → 004 → 005 → 006 → 007
```

## Re-runs in production

Migrations marked **Yes** above can be re-applied via `apply_migration` /
`supabase db push` safely — they detect their own previous state and
no-op. The seed migrations (003 / 004) will not re-insert rows that
already exist, so to refresh seed data, `UPDATE` the existing rows or
add a separate fix-up migration; never delete-and-re-seed in production.

## Re-runs in `No` rows

To roll out a change touching migration 001 or 002, write a new
migration file (007 and onward) that uses `DROP POLICY IF EXISTS … ;
CREATE POLICY …` or `ALTER TABLE …` to evolve the existing schema.
Never edit a previously-applied 001/002 file in place — Supabase
won't re-apply it.

## Local testing

`tests/helpers/db.ts` applies all six migrations against a vanilla
Postgres 16 cluster. See `docs/development/test-harness.md` for the
unaccent + role + storage stubs that bridge Supabase's environment
gaps locally.
