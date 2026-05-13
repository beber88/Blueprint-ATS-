# Employee Lifecycle — Operations Intelligence

This document defines the **only** supported way to manage employees in the
Operations Intelligence module. Read it before touching `op_employees` or
`op_employees_history` from application code.

## Tables involved

- `op_employees` — the **active roster**. Every row that represents a person
  currently working for the company. Soft-deleted rows (former employees)
  stay here with `is_active = false`.
- `op_employees_history` — the **separation log**. One row per separation
  event (resigned / terminated / transferred). May link back to `op_employees`
  via `employee_id` (nullable, `ON DELETE SET NULL`).

## Invariants

1. An employee that is **currently working** has exactly one row in
   `op_employees` with `is_active = true`.
2. A `full_name` is unique **only among active rows** (`op_employees_active_full_name_uidx`
   partial unique index). Two rows with the same `full_name` are allowed iff
   at most one of them has `is_active = true`. This is how re-hires work.
3. When an active employee separates, a row is added to
   `op_employees_history` (status `resigned` | `terminated` | `transferred`)
   and the corresponding `op_employees.is_active` flips to `false`. The
   active row is **never deleted** from application code.
4. `op_employees_history.employee_id` may be `NULL` for legacy rows seeded
   before the active roster existed (the 15 historical entries from
   migration 004). For all separations going forward, set it explicitly.
5. Every read of "currently working employees" MUST filter
   `WHERE is_active = true`. There is no view; the filter is the contract.

## Workflow — separating an active employee

```sql
-- 1. Add the history row, linked to the active row.
INSERT INTO op_employees_history
  (full_name, role, department_id, department_code,
   status, started_at, ended_at, reason, source_documents, employee_id)
SELECT e.full_name, e.role, e.department_id, d.code,
       'resigned', e.created_at::date, CURRENT_DATE,
       'Personal reasons', 'Resignation letter 2026-06-15', e.id
FROM op_employees e
LEFT JOIN op_departments d ON d.id = e.department_id
WHERE e.id = '00000000-0000-0000-0000-000000000000';  -- the active employee's id

-- 2. Soft-delete the active row. DO NOT use DELETE.
UPDATE op_employees
SET is_active = FALSE, updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000000';
```

## Workflow — re-hiring a former employee under the same name

```sql
-- The old row stays as is_active=false. Insert a fresh active row.
-- The partial unique index allows this because only ONE active row per
-- full_name is permitted.
INSERT INTO op_employees (full_name, role, department_id, is_pm, is_active)
VALUES ('Adrian', 'Driver',
        (SELECT id FROM op_departments WHERE code = 'admin'),
        FALSE, TRUE);
```

## Workflow — selecting only active employees (REQUIRED)

```sql
-- Every list / lookup must include this filter. There is no "active" view.
SELECT id, full_name, role, department_id
FROM op_employees
WHERE is_active = TRUE
ORDER BY full_name;
```

## What is NOT allowed from application code

- `DELETE FROM op_employees …` — only ever permitted from a manual DBA
  migration with the CEO's approval. The application MUST soft-delete.
- Inserting into `op_employees_history` without first verifying that the
  matching `op_employees` row (if any) has `is_active = false` OR setting
  `employee_id = NULL` (when the person predates the roster).
- Reading `op_employees` without an `is_active = true` filter in any UI list
  or dropdown that shows "current staff".

## What this gives us

- **No orphans.** History rows keep their FK to `op_employees` for as long
  as the active row exists. If a DBA ever runs `DELETE FROM op_employees`,
  the `ON DELETE SET NULL` rule prevents history rows from being deleted —
  they just lose the link, while `full_name` + `department_code` +
  `source_documents` keep them self-describing.
- **Re-hires work.** Partial unique index permits one active + many inactive
  rows per name.
- **No data loss.** Soft-deletes mean every employee record we've ever had is
  recoverable. The active roster stays small via the `is_active = true`
  filter that every UI query already uses.
