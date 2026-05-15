-- Blueprint HRIS - Phase 1 (rebased): extend existing op_* / hr_* tables
-- DOES NOT create duplicate employees/departments tables.
-- Adds the columns and timeline table required by the new HRIS UI on top of
-- the existing op_employees / op_departments / hr_employee_documents schema
-- already in production.

-- Idempotent extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
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

-- =====================================================================
-- op_employees: add HRIS columns (additive only)
-- =====================================================================
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS full_name_en TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS full_name_he TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS full_name_tl TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS employment_status TEXT
  CHECK (employment_status IN ('active','probation','on_leave','terminated','resigned'));
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS government_ids JSONB DEFAULT '{}'::jsonb;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual','drive_sync','migrated_from_candidate','import','seed'));
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS candidate_id UUID
  REFERENCES candidates(id) ON DELETE SET NULL;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS merged_into_id UUID
  REFERENCES op_employees(id) ON DELETE SET NULL;

-- Backfill: derive employment_status from is_active for existing rows
UPDATE op_employees
SET employment_status = CASE WHEN is_active THEN 'active' ELSE 'terminated' END
WHERE employment_status IS NULL;

-- Backfill: position from role for existing rows (role is the historical column)
UPDATE op_employees SET position = role WHERE position IS NULL AND role IS NOT NULL;

-- Backfill source for existing seed rows
UPDATE op_employees SET source = 'seed' WHERE source IS NULL OR source = 'manual' AND created_at < NOW() - INTERVAL '1 day';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_op_employees_status ON op_employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_op_employees_dept ON op_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_op_employees_candidate ON op_employees(candidate_id);
CREATE INDEX IF NOT EXISTS idx_op_employees_code ON op_employees(employee_code);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_op_employees_name_trgm
      ON op_employees USING gin (full_name gin_trgm_ops);
  END IF;
END $$;

-- =====================================================================
-- op_departments: add HRIS columns (additive only)
-- =====================================================================
ALTER TABLE op_departments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE op_departments ADD COLUMN IF NOT EXISTS parent_department_id UUID
  REFERENCES op_departments(id) ON DELETE SET NULL;
ALTER TABLE op_departments ADD COLUMN IF NOT EXISTS head_employee_id UUID
  REFERENCES op_employees(id) ON DELETE SET NULL;
ALTER TABLE op_departments ADD COLUMN IF NOT EXISTS cost_center TEXT;
ALTER TABLE op_departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_op_departments_parent ON op_departments(parent_department_id);

-- =====================================================================
-- hr_employee_documents: add HRIS columns (additive only)
-- =====================================================================
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS original_language TEXT
  CHECK (original_language IN ('he','en','tl','unknown'));
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Ensure FK to op_employees exists (best-effort; if a different FK exists already it stays)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'hr_employee_documents'
      AND c.contype = 'f'
      AND c.confrelid = (SELECT oid FROM pg_class WHERE relname = 'op_employees' LIMIT 1)
  ) THEN
    BEGIN
      ALTER TABLE hr_employee_documents
        ADD CONSTRAINT fk_hr_employee_documents_employee
        FOREIGN KEY (employee_id) REFERENCES op_employees(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_employee ON hr_employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_type ON hr_employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_hash ON hr_employee_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_drive ON hr_employee_documents(drive_file_id);

-- =====================================================================
-- hr_employee_timeline: NEW table for generic per-employee activity log
-- (hr_role_history exists but is role-only; this is for any HRIS event)
-- =====================================================================
CREATE TABLE IF NOT EXISTS hr_employee_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES op_employees(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_hr_employee_timeline_employee ON hr_employee_timeline(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_timeline_event_date ON hr_employee_timeline(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_employee_timeline_event_type ON hr_employee_timeline(event_type);

ALTER TABLE hr_employee_timeline ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_employee_timeline' AND policyname = 'Allow authenticated access') THEN
    CREATE POLICY "Allow authenticated access" ON hr_employee_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_employee_timeline' AND policyname = 'Allow service role access') THEN
    CREATE POLICY "Allow service role access" ON hr_employee_timeline FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =====================================================================
-- Storage bucket hr-documents already exists (verified 2026-05-15).
-- Storage policies (idempotent)
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated read hr-documents'
  ) THEN
    CREATE POLICY "Allow authenticated read hr-documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'hr-documents');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated upload hr-documents'
  ) THEN
    CREATE POLICY "Allow authenticated upload hr-documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'hr-documents');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow service role all hr-documents'
  ) THEN
    CREATE POLICY "Allow service role all hr-documents"
      ON storage.objects FOR ALL TO service_role
      USING (bucket_id = 'hr-documents')
      WITH CHECK (bucket_id = 'hr-documents');
  END IF;
END $$;
