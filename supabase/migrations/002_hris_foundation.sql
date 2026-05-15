-- Blueprint HRIS - Phase 1: Foundation (departments, employees, employee_documents)
-- Additive only. Does NOT modify existing ATS tables.

-- Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- DEPARTMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  name_he TEXT,
  name_tl TEXT,
  description TEXT,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  head_employee_id UUID,
  cost_center TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);

-- =====================================================================
-- EMPLOYEES
-- =====================================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  full_name_en TEXT,
  full_name_he TEXT,
  full_name_tl TEXT,
  email TEXT,
  phone TEXT,
  position TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  hire_date DATE,
  employment_status TEXT DEFAULT 'active' CHECK (employment_status IN (
    'active','probation','on_leave','terminated','resigned'
  )),
  birth_date DATE,
  address TEXT,
  emergency_contact JSONB DEFAULT '{}'::jsonb,
  government_ids JSONB DEFAULT '{}'::jsonb,
  photo_url TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN (
    'manual','drive_sync','migrated_from_candidate','import'
  )),
  source_metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  merged_into_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_candidate ON employees(candidate_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_name_trgm ON employees USING gin (full_name gin_trgm_ops);

-- pg_trgm for fuzzy name search (optional — fallback if extension missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    BEGIN
      CREATE EXTENSION pg_trgm;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- Departments head FK (deferred until employees exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_head_employee'
  ) THEN
    ALTER TABLE departments
      ADD CONSTRAINT fk_departments_head_employee
      FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================================
-- EMPLOYEE DOCUMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'contract','id','certificate','payslip','government','warning','achievement',
    'report','attendance','medical','tax','other'
  )),
  title TEXT,
  file_url TEXT,
  file_hash TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  original_language TEXT CHECK (original_language IN ('he','en','tl','unknown')),
  drive_file_id TEXT,
  provenance JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_employee_documents_hash ON employee_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_employee_documents_drive ON employee_documents(drive_file_id);

-- =====================================================================
-- EMPLOYEE TIMELINE (audit / history of activities on each employee)
-- =====================================================================
CREATE TABLE IF NOT EXISTS employee_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ DEFAULT NOW(),
  title TEXT,
  description TEXT,
  related_table TEXT,
  related_id UUID,
  actor_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_timeline_employee ON employee_timeline(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_timeline_event_date ON employee_timeline(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_timeline_event_type ON employee_timeline(event_type);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON departments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON employees FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access" ON employee_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON employee_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access" ON employee_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON employee_timeline FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- STORAGE BUCKET FOR HR DOCUMENTS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated read hr-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents');

CREATE POLICY "Allow authenticated upload hr-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents');

CREATE POLICY "Allow service role all hr-documents"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'hr-documents')
  WITH CHECK (bucket_id = 'hr-documents');

-- =====================================================================
-- SEED: default departments (idempotent)
-- =====================================================================
INSERT INTO departments (name, name_en, name_he, name_tl)
VALUES
  ('Human Resources', 'Human Resources', 'משאבי אנוש', 'Human Resources'),
  ('Operations', 'Operations', 'תפעול', 'Operations'),
  ('Finance', 'Finance', 'כספים', 'Pananalapi'),
  ('Construction', 'Construction', 'בנייה', 'Konstruksyon'),
  ('Administration', 'Administration', 'מנהלה', 'Administrasyon')
ON CONFLICT DO NOTHING;
