-- Blueprint HR — Operations Intelligence: Employee History
-- Tracks resigned, terminated, and transferred employees so that the active
-- roster (op_employees) stays clean while the audit trail is preserved.
--
-- IDEMPOTENT — SAFE TO RE-RUN.
-- Source-of-truth: samples/operations/employees_status.json (history + transfers).

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_employees_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT,
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  department_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('resigned','terminated','transferred')),
  started_at DATE,
  ended_at DATE,
  reason TEXT,
  source_documents TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make full_name unique so re-running the seed is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'op_employees_history_full_name_key'
  ) THEN
    ALTER TABLE op_employees_history
      ADD CONSTRAINT op_employees_history_full_name_key UNIQUE (full_name);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_op_employees_history_status
  ON op_employees_history(status);
CREATE INDEX IF NOT EXISTS idx_op_employees_history_ended_at
  ON op_employees_history(ended_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirrors the rest of the op_* tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_employees_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_employees_history'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON op_employees_history
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_employees_history'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON op_employees_history
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed — historical employees (resigned + terminated) and 1 transfer
-- Source: samples/operations/employees_status.json
-- ─────────────────────────────────────────────────────────────────────────────

WITH dept_lookup AS (
  SELECT id, code FROM op_departments
)
INSERT INTO op_employees_history
  (full_name, role, department_id, department_code, status, started_at, ended_at, reason, source_documents, notes)
SELECT t.full_name, t.role, d.id, t.dept_code, t.status, t.started_at, t.ended_at, t.reason, t.source_documents, t.notes
FROM (VALUES
  -- Terminations and resignations (ordered by ended_at)
  ('Roque Clarion',                'Project Manager',          'projects',     'terminated', '2025-01-16'::date, '2025-03-28'::date,
   'Failed training evaluation',
   'case file 00000101 / 00000109', NULL),
  ('Maria Danica Gabayno',         'Quantity Surveyor',        'qs',           'resigned',   NULL,                '2025-09-05'::date,
   'Short-notice resignation (5 days vs required 30)',
   'HR doc 00000026', NULL),
  ('Mary Erica Servancia',         'Site Engineer',            'projects',     'resigned',   NULL,                '2025-09-09'::date,
   'Resignation accepted, last day Sep 9 2025',
   'HR doc 00000028', NULL),
  ('Jennifer Villaverde',          'Engineering staff',        'projects',     'terminated', NULL,                '2025-09-25'::date,
   'Termination per management directive',
   'Daily report 09/25 + WhatsApp', NULL),
  ('Adrian',                       'Driver',                   'admin',        'resigned',   NULL,                '2025-09-30'::date,
   'Resignation, last day end Sep 2025',
   'WhatsApp 09/28-09/29', NULL),
  ('Lara',                         'Architect',                'architecture', 'resigned',   NULL,                '2025-10-15'::date,
   'Personal — board exam prep + mother''s cancer care',
   'Daily report 10/15 + WhatsApp 10/16', NULL),
  ('Mela',                         'Maintenance Manager',      'maintenance',  'terminated', NULL,                '2025-10-20'::date,
   'Inefficiency and lack of professionalism',
   'WhatsApp 10/20', NULL),
  ('Myla Baldueza',                'Maintenance',              'maintenance',  'terminated', NULL,                '2025-10-22'::date,
   'End of probation',
   'Daily report 10/22 — PIP notice', NULL),
  ('Joshua Brian Phil Delatado',   'Architect',                'architecture', 'resigned',   '2023-10-17'::date,  '2025-11-14'::date,
   'Resignation, notice period waived',
   'Letter 00000316', NULL),
  ('Jet Jandusay',                 'Site Engineer (Pampanga)', 'projects',     'terminated', '2025-02-26'::date,  '2025-12-01'::date,
   'Replaced after multiple memos + PIP',
   'Daily report 12/01 + CEO directive 09/16', NULL),
  ('Ofir Levy',                    'Operations VP',            'projects',     'terminated', NULL,                '2026-02-06'::date,
   'Separation per management — waiver of notice',
   'Notice 00000473', NULL),
  ('Appoch Kaye Rolloque',         'Maintenance Manager',      'maintenance',  'terminated', '2025-10-13'::date,  '2026-02-24'::date,
   'Performance — replaced by Mark Lee Bercasio',
   'Daily report 02/24', NULL),
  ('Mark Lee Bercasio',            'Maintenance Manager',      'maintenance',  'terminated', '2026-02-25'::date,  '2026-04-24'::date,
   'Non-regularization — failed probationary standards',
   'Notice 00000676', NULL),
  ('Darwin Constantino',           'Quantity Surveyor',        'qs',           'terminated', '2025-10-02'::date,  '2026-04-29'::date,
   'Performance — CEO directive: stop work with Darwin',
   'WhatsApp 2026-02-17 + tapering daily reports', NULL),
  -- Transfers — kept here because the role/assignment changed materially.
  ('Jose (Joey) Cepeda',           'Driver',                   'admin',        'transferred', NULL,               '2026-02-07'::date,
   'Reassigned from Personal Driver (Ofir Levy) to JPL',
   'Notice 00000474',
   'Still active — transferred, not separated')
) AS t(full_name, role, dept_code, status, started_at, ended_at, reason, source_documents, notes)
LEFT JOIN dept_lookup d ON d.code = t.dept_code
ON CONFLICT (full_name) DO NOTHING;
