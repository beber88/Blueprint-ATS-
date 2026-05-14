-- Blueprint HR — Full HR Management Module
-- Adds comprehensive HR tables for employee management, leave, attendance,
-- salary, performance reviews, training, onboarding/offboarding, shifts,
-- assets, and email ingestion.
--
-- All tables prefixed `hr_` to namespace from existing op_ and ct_ tables.
-- op_employees remains the single source of truth for employee identity;
-- all hr_ tables reference it via FK.
--
-- IDEMPOTENT — SAFE TO RE-RUN.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend op_employees with additional HR fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS emergency_contact JSONB;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time';
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS salary_grade TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS manager_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'op_employees_manager_id_fkey'
  ) THEN
    ALTER TABLE op_employees
      ADD CONSTRAINT op_employees_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES op_employees(id) ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'op_employees_employment_type_check'
  ) THEN
    ALTER TABLE op_employees
      ADD CONSTRAINT op_employees_employment_type_check
      CHECK (employment_type IN ('full-time','part-time','contract','project','internship','daily'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_op_employees_manager ON op_employees(manager_id) WHERE manager_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_emails — Ingested email records from Gmail
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT UNIQUE NOT NULL,
  thread_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  received_at TIMESTAMPTZ NOT NULL,
  classification JSONB,
  routed_to TEXT,
  routed_record_id UUID,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','classified','routed','failed','ignored')),
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_emails_from ON hr_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_hr_emails_status ON hr_emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_hr_emails_received ON hr_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_emails_routed ON hr_emails(routed_to) WHERE routed_to IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_employee_documents — Employee file attachments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('contract','id','certificate','memo','evaluation','medical','visa','license','other')),
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID,
  notes TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_employee ON hr_employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_type ON hr_employee_documents(document_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_role_history — Role / department change history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL,
  end_date DATE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_role_history_employee ON hr_role_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_role_history_effective ON hr_role_history(effective_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_leave_balances — Annual leave balances per type
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('vacation','sick','personal','maternity','paternity','unpaid','bereavement','emergency')),
  total_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  UNIQUE(employee_id, year, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_employee_year ON hr_leave_balances(employee_id, year);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_leave_requests — Leave / sick day requests with approval workflow
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('vacation','sick','personal','maternity','paternity','unpaid','bereavement','emergency')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(5,1) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES op_employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','email','whatsapp')),
  source_email_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_dates ON hr_leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_pending ON hr_leave_requests(status) WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_attendance — Clock in/out records with overtime
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_hours NUMERIC(4,1),
  overtime_hours NUMERIC(4,1) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present','absent','late','half_day','leave','holiday','rest_day')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','report','email','system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date ON hr_attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_status ON hr_attendance(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_salary — Salary records with allowances / deductions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_salary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP'
    CHECK (length(currency) = 3),
  pay_frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (pay_frequency IN ('monthly','semi-monthly','bi-weekly','weekly','daily')),
  allowances JSONB DEFAULT '{}'::jsonb,
  deductions JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_salary_employee ON hr_salary(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_salary_effective ON hr_salary(employee_id, effective_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_payslips — Monthly pay slip records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_pay NUMERIC(12,2),
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2),
  breakdown JSONB DEFAULT '{}'::jsonb,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','final','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_payslips_employee ON hr_payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payslips_period ON hr_payslips(period_start, period_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_performance_reviews — Periodic reviews with scores and goals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  review_period TEXT,
  review_date DATE NOT NULL,
  overall_score NUMERIC(3,1)
    CHECK (overall_score IS NULL OR (overall_score >= 1.0 AND overall_score <= 5.0)),
  scores JSONB DEFAULT '{}'::jsonb,
  strengths TEXT,
  improvements TEXT,
  goals JSONB DEFAULT '[]'::jsonb,
  employee_comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','acknowledged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_employee ON hr_performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_date ON hr_performance_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_status ON hr_performance_reviews(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_training_courses — Course catalog
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  provider TEXT,
  category TEXT
    CHECK (category IS NULL OR category IN ('safety','technical','management','compliance','soft_skills','certification')),
  duration_hours INTEGER,
  is_mandatory BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_training_courses_category ON hr_training_courses(category);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_training_enrollments — Employee-course assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES hr_training_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  certificate_path TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled','in_progress','completed','failed','cancelled')),
  UNIQUE(employee_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_employee ON hr_training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_course ON hr_training_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_status ON hr_training_enrollments(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_onboarding_templates — Checklist templates for onboarding / offboarding
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  process_type TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (process_type IN ('onboarding','offboarding')),
  role_category TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_onboarding_tasks — Onboarding / offboarding task instances
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  template_id UUID REFERENCES hr_onboarding_templates(id) ON DELETE SET NULL,
  process_type TEXT NOT NULL
    CHECK (process_type IN ('onboarding','offboarding')),
  task TEXT NOT NULL,
  assignee_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped')),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_tasks_employee ON hr_onboarding_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_tasks_assignee ON hr_onboarding_tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_tasks_status ON hr_onboarding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_tasks_type ON hr_onboarding_tasks(process_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_shift_definitions — Shift types (morning, evening, night, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_shift_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  color TEXT DEFAULT '#C9A84C',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_shift_assignments — Employee-shift-date assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES hr_shift_definitions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_employee ON hr_shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_date ON hr_shift_assignments(date);
CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_shift ON hr_shift_assignments(shift_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_assets — Equipment / asset inventory
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL
    CHECK (asset_type IN ('laptop','phone','tablet','vehicle','key','ppe','tool','uniform','furniture','other')),
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  asset_tag TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','assigned','maintenance','retired','lost')),
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_assets_type ON hr_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_hr_assets_status ON hr_assets(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_asset_assignments — Asset-employee assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES hr_assets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  condition_on_assign TEXT,
  condition_on_return TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hr_asset_assignments_asset ON hr_asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_hr_asset_assignments_employee ON hr_asset_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_asset_assignments_active ON hr_asset_assignments(returned_at) WHERE returned_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirror the rest of the platform
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'hr_emails',
    'hr_employee_documents',
    'hr_role_history',
    'hr_leave_balances',
    'hr_leave_requests',
    'hr_attendance',
    'hr_salary',
    'hr_payslips',
    'hr_performance_reviews',
    'hr_training_courses',
    'hr_training_enrollments',
    'hr_onboarding_templates',
    'hr_onboarding_tasks',
    'hr_shift_definitions',
    'hr_shift_assignments',
    'hr_assets',
    'hr_asset_assignments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = 'Allow authenticated access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Allow authenticated access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = 'Allow service role access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Allow service role access" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;
  END LOOP;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for HR documents (private)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'hr-documents: authenticated read'
  ) THEN
    CREATE POLICY "hr-documents: authenticated read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'hr-documents');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'hr-documents: authenticated insert'
  ) THEN
    CREATE POLICY "hr-documents: authenticated insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'hr-documents');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'hr-documents: service_role all'
  ) THEN
    CREATE POLICY "hr-documents: service_role all" ON storage.objects
      FOR ALL TO service_role
      USING (bucket_id = 'hr-documents') WITH CHECK (bucket_id = 'hr-documents');
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Useful views
-- ─────────────────────────────────────────────────────────────────────────────

-- Active leave balances (remaining days)
CREATE OR REPLACE VIEW hr_leave_balances_v AS
SELECT
  lb.*,
  e.full_name,
  e.department_id,
  (lb.total_days - lb.used_days) AS remaining_days
FROM hr_leave_balances lb
JOIN op_employees e ON e.id = lb.employee_id
WHERE e.is_active = TRUE;

-- Pending leave requests with employee info
CREATE OR REPLACE VIEW hr_pending_leaves_v AS
SELECT
  lr.*,
  e.full_name,
  e.department_id,
  d.name AS department_name
FROM hr_leave_requests lr
JOIN op_employees e ON e.id = lr.employee_id
LEFT JOIN op_departments d ON d.id = e.department_id
WHERE lr.status = 'pending';

-- Current asset assignments (not yet returned)
CREATE OR REPLACE VIEW hr_active_asset_assignments_v AS
SELECT
  aa.*,
  a.asset_type,
  a.brand,
  a.model,
  a.serial_number,
  a.asset_tag,
  e.full_name
FROM hr_asset_assignments aa
JOIN hr_assets a ON a.id = aa.asset_id
JOIN op_employees e ON e.id = aa.employee_id
WHERE aa.returned_at IS NULL;
