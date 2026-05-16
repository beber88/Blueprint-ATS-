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
| 008 | `008_contracts_schema.sql` | **Yes** | 002 | Contracts module Spine. Creates `ct_contracts`, `ct_contract_drafts` (mirrors `op_report_drafts`), `ct_alerts` with partial unique on `(contract_id, type) WHERE resolved_at IS NULL`. New private storage bucket `contracts`. FK `ct_contracts.draft_source_id → ct_contract_drafts(id)` ON DELETE SET NULL. Idempotency via `DO $$ IF NOT EXISTS` blocks. |
| 009 | `009_contract_folders.sql` | **Yes** | 008 | Adds hierarchical folder support for the contracts file-manager UI: `ct_folders` table + `ct_contracts.folder_id` FK + `get_folder_breadcrumbs` RPC. |
| 010 | `010_hr_modules.sql` | **Yes** | 002 | Full HR module: 17 `hr_*` tables (`hr_emails`, `hr_employee_documents`, `hr_role_history`, `hr_leave_balances`, `hr_leave_requests`, `hr_attendance`, `hr_salary`, `hr_payslips`, `hr_performance_reviews`, `hr_training_courses`, `hr_training_enrollments`, `hr_onboarding_templates`, `hr_onboarding_tasks`, `hr_shift_definitions`, `hr_shift_assignments`, `hr_assets`, `hr_asset_assignments`). Extends `op_employees` with `date_of_birth`, `gender`, `address`, `emergency_contact`, `hire_date`, `national_id`, `employment_type`, `salary_grade`, `manager_id`. New private `hr-documents` storage bucket. |
| 011 | `011_role_based_access.sql` | **Yes** | 010 | RBAC: installs the `user_has_role(text[])` SECURITY DEFINER helper, restricts sensitive `hr_*` tables (salary, payslips, emails, reviews, documents, leave, leave_balances) to `admin`+`hr` roles, and locks down `user_profiles` to self-read + admin-write. |
| 012 | `012_employee_profile_gapfill.sql` | **Yes** | 010, 011 | Employee-profile gap-fill: 9 new additive tables (`hr_employment_contracts`, `hr_salary_schedules`, `hr_benefits`, `hr_disciplinary_records`, `hr_recognitions`, `hr_compliance_records`, `hr_employee_notes`, `hr_alerts`, `hr_profile_grants`) + RLS via the migration-011 `user_has_role()` helper + grant-based read access through `hr_profile_grants`. Reuses the `hr-documents` bucket from 010 (no new bucket). Partial unique on `hr_salary_schedules(employee_id) WHERE status='pending'` and on `hr_alerts(employee_id, type) WHERE resolved_at IS NULL` for cron idempotency. |

## Apply order

```
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012
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

`tests/helpers/db.ts` applies all migrations against a vanilla
Postgres 16 cluster. See `docs/development/test-harness.md` for the
unaccent + role + storage stubs that bridge Supabase's environment
gaps locally.
