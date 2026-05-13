-- Blueprint HR — Operations Intelligence: Employee Lifecycle Constraints
--
-- IDEMPOTENT — SAFE TO RE-RUN.
--
-- Three coupled changes that together enable the soft-delete + history-link
-- workflow described in docs/operations/employee-lifecycle.md:
--
--   A. op_employees.is_active becomes NOT NULL (default true).
--      Soft-deletes (is_active=false) preserve every FK from history without
--      orphaning, because the row still exists.
--
--   B. Drop the GLOBAL UNIQUE on op_employees.full_name (added by 003) and
--      replace it with a PARTIAL unique index limited to is_active=true.
--      This way: an employee who left can be re-hired later under the same
--      name (the old row stays as is_active=false, a fresh active row is
--      created). No data loss, no FK breakage.
--
--   C. op_employees_history.employee_id — optional FK to op_employees(id),
--      ON DELETE SET NULL. NULL for the 15 already-seeded historical rows
--      (those people predate the active roster). For future separations the
--      app sets it before flipping is_active=false.
--
-- All steps are guarded so that re-running this migration on a database that
-- already has the new state produces no further change.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Backfill and lock down op_employees.is_active
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE op_employees SET is_active = TRUE WHERE is_active IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'op_employees'
      AND column_name = 'is_active'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE op_employees ALTER COLUMN is_active SET NOT NULL;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Swap global UNIQUE → partial UNIQUE on full_name
--    Order: ADD partial first, then DROP global. Postgres allows two
--    overlapping uniqueness guarantees, so during the brief window between
--    these statements existing data is still protected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS op_employees_active_full_name_uidx
  ON op_employees(full_name) WHERE is_active = TRUE;

ALTER TABLE op_employees DROP CONSTRAINT IF EXISTS op_employees_full_name_key;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. op_employees_history.employee_id — optional FK with SET NULL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_employees_history
  ADD COLUMN IF NOT EXISTS employee_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'op_employees_history_employee_id_fkey'
  ) THEN
    ALTER TABLE op_employees_history
      ADD CONSTRAINT op_employees_history_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES op_employees(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_op_employees_history_employee_id
  ON op_employees_history(employee_id);
