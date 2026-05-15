-- ═══════════════════════════════════════════════════════════════
-- Migration 012: Employee profile gap-fill
--
-- Purely ADDITIVE. Fills the gaps the existing HR module (migration
-- 010) leaves open for a "fully personalized employee profile":
-- employment contracts, scheduled salary increases, structured
-- benefits, disciplinary records, recognitions, government
-- compliance records, internal notes, profile-level alerts, and
-- ad-hoc profile grants for RBAC.
--
-- Nothing in this migration modifies existing tables, columns,
-- constraints, or policies from migrations 001-011. Every CREATE
-- is guarded with IF NOT EXISTS so re-applying produces zero drift.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- hr_employment_contracts — distinct from ct_contracts (B2B).
-- Holds the company ↔ employee agreement: type, dates, base salary,
-- working hours, terms text, company-side obligations.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_employment_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  employment_type TEXT NOT NULL
    CHECK (employment_type IN ('permanent','fixed_term','probation','consultant','intern')),
  start_date DATE NOT NULL,
  end_date DATE,
  probation_period_days INT,
  notice_period_days INT,
  working_hours_per_week NUMERIC(4,1),
  working_days TEXT[],
  salary_base NUMERIC(14,2),
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  terms_text TEXT,
  terms_storage_path TEXT,
  obligations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','expired','terminated','superseded')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_employment_contracts_employee
  ON hr_employment_contracts(employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_employment_contracts_status
  ON hr_employment_contracts(status);
CREATE INDEX IF NOT EXISTS idx_hr_employment_contracts_end_date
  ON hr_employment_contracts(end_date) WHERE end_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- hr_salary_schedules — planned future raises.
-- When applied, the helper inserts a new hr_salary row with the
-- new effective_date. Partial-unique enforces "one pending at a
-- time per employee".
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_salary_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  expected_amount NUMERIC(14,2) NOT NULL,
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','applied','cancelled')),
  applied_at TIMESTAMPTZ,
  applied_salary_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_salary_schedules_employee
  ON hr_salary_schedules(employee_id, scheduled_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_salary_schedules_one_pending
  ON hr_salary_schedules(employee_id) WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────
-- hr_benefits — structured, typed benefits/allowances.
-- Complements hr_salary.allowances (JSONB) which stays as-is.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('health','transport','meal','phone','education','car','housing','bonus_target','other')),
  monthly_value NUMERIC(14,2),
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_benefits_employee_type
  ON hr_benefits(employee_id, type);

-- ─────────────────────────────────────────────────────────────────
-- hr_disciplinary_records — warnings / NTE / suspensions.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_disciplinary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  incident_date DATE,
  action_date DATE NOT NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN ('verbal_warning','written_warning','nte','suspension','final_warning','demotion','termination')),
  description TEXT,
  action_taken TEXT,
  follow_up_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','escalated')),
  storage_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_disciplinary_employee
  ON hr_disciplinary_records(employee_id, action_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_disciplinary_open
  ON hr_disciplinary_records(status) WHERE status = 'open';

-- ─────────────────────────────────────────────────────────────────
-- hr_recognitions — awards, bonuses, public praise, certifications.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('award','spot_bonus','public_praise','certification','milestone','promotion_letter')),
  title TEXT NOT NULL,
  description TEXT,
  monetary_amount NUMERIC(14,2),
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  granted_by UUID,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_recognitions_employee
  ON hr_recognitions(employee_id, date DESC);

-- ─────────────────────────────────────────────────────────────────
-- hr_compliance_records — government records (SSS / PhilHealth /
-- HDMF / BIR / TIN / work permits / visas) with expiry tracking.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL
    CHECK (record_type IN ('sss','philhealth','hdmf','bir_tin','work_permit','visa','contract_filing','medical_cert','nbi_clearance','other')),
  identifier_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid','expired','renewing','pending')),
  storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_compliance_employee
  ON hr_compliance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_compliance_expiry
  ON hr_compliance_records(expiry_date) WHERE expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- hr_employee_notes — internal management notes, threaded.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_employee_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  author_id UUID,
  note_text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'admin'
    CHECK (visibility IN ('admin','granted')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  parent_note_id UUID REFERENCES hr_employee_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_notes_employee
  ON hr_employee_notes(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_employee_notes_pinned
  ON hr_employee_notes(employee_id) WHERE pinned = TRUE;

-- ─────────────────────────────────────────────────────────────────
-- hr_alerts — profile-level alerts created by the daily cron.
-- Partial unique on (employee_id, type) WHERE resolved_at IS NULL
-- makes the cron idempotent.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('compliance_expiring','compliance_expired','salary_increase_due','contract_expiring','probation_ending','document_expiring')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high')),
  message TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_alerts_employee
  ON hr_alerts(employee_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_alerts_one_open_per_type
  ON hr_alerts(employee_id, type) WHERE resolved_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- hr_profile_grants — admin-issued ad-hoc grant of view access
-- to a specific employee's profile. user_id is TEXT to match
-- user_profiles.id (which stores auth.uid() as text).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_profile_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  granted_by_user_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_hr_profile_grants_user
  ON hr_profile_grants(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hr_profile_grants_employee
  ON hr_profile_grants(employee_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_profile_grants_unique_active
  ON hr_profile_grants(user_id, employee_id) WHERE revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- RLS — defense in depth.
-- Primary gate is the API layer via lib/hr/access.ts. These
-- policies are the safety net for direct PostgREST access through
-- the anon key. Pattern: admin/hr always, others only with an
-- active hr_profile_grants row.
--
-- We use the existing user_has_role() helper installed in
-- migration 011 so we don't duplicate auth logic.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE hr_employment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salary_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_disciplinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_profile_grants ENABLE ROW LEVEL SECURITY;

-- Service-role bypass on every new table — server APIs use the
-- admin client and need full access.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_employment_contracts',
    'hr_salary_schedules',
    'hr_benefits',
    'hr_disciplinary_records',
    'hr_recognitions',
    'hr_compliance_records',
    'hr_employee_notes',
    'hr_alerts',
    'hr_profile_grants'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = 'service_role: full access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "service_role: full access" ON %I FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE)',
        t
      );
    END IF;
  END LOOP;
END
$$;

-- Admin/HR full access on every new table.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_employment_contracts',
    'hr_salary_schedules',
    'hr_benefits',
    'hr_disciplinary_records',
    'hr_recognitions',
    'hr_compliance_records',
    'hr_employee_notes',
    'hr_alerts',
    'hr_profile_grants'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = format('%I: admin and hr', t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%I: admin and hr" ON %I FOR ALL TO authenticated USING (public.user_has_role(ARRAY[''admin'',''hr''])) WITH CHECK (public.user_has_role(ARRAY[''admin'',''hr'']))',
        t, t
      );
    END IF;
  END LOOP;
END
$$;

-- Granted-user read access on the per-employee tables (NOT on
-- hr_profile_grants itself — only admins manage grants).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_employment_contracts',
    'hr_salary_schedules',
    'hr_benefits',
    'hr_disciplinary_records',
    'hr_recognitions',
    'hr_compliance_records',
    'hr_employee_notes',
    'hr_alerts'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = format('%I: granted read', t)
    ) THEN
      EXECUTE format($f$
        CREATE POLICY "%I: granted read" ON %I FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM hr_profile_grants g
            WHERE g.user_id = auth.uid()::text
              AND g.employee_id = %I.employee_id
              AND g.revoked_at IS NULL
              AND (g.expires_at IS NULL OR g.expires_at > NOW())
          )
        )
      $f$, t, t, t);
    END IF;
  END LOOP;
END
$$;
