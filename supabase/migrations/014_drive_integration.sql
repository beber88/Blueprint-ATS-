-- Google Drive Integration: file sync tracking + project enrichment
-- Enables automatic sync of Drive folders into HR tables

-- ─── Drive Files Catalog ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drive_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id   TEXT NOT NULL UNIQUE,
  drive_parent_id TEXT,
  name            TEXT NOT NULL,
  mime_type       TEXT,
  file_size       BIGINT,
  md5_checksum    TEXT,
  drive_path      TEXT NOT NULL,            -- full folder path e.g. "Admin/Employee/Engineer/Jester"
  drive_view_url  TEXT,
  -- Classification
  classification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (classification_status IN ('pending','classified','routed','skipped','error','needs_review')),
  target_table    TEXT,                     -- e.g. 'hr_employee_documents', 'hr_payslips'
  target_id       UUID,                     -- ID of the created row in target table
  document_type   TEXT,                     -- e.g. 'contract', 'id', 'government', 'payslip'
  matched_employee_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  matched_project_id  UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  classification_json JSONB,               -- AI classification details
  processing_error    TEXT,
  -- Timestamps
  drive_created_at  TIMESTAMPTZ,
  drive_modified_at TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  routed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_files_status ON drive_files(classification_status);
CREATE INDEX IF NOT EXISTS idx_drive_files_parent ON drive_files(drive_parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_path ON drive_files(drive_path);
CREATE INDEX IF NOT EXISTS idx_drive_files_employee ON drive_files(matched_employee_id);

-- ─── Drive Sync State ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drive_sync_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_folder_id  TEXT NOT NULL,
  last_sync_at    TIMESTAMPTZ,
  files_synced    INTEGER DEFAULT 0,
  files_routed    INTEGER DEFAULT 0,
  files_error     INTEGER DEFAULT 0,
  sync_status     TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle','running','completed','failed')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Enrich op_projects with Drive data ────────────────────────────────────────

ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS project_type TEXT;  -- clinic, condo, residential, restaurant
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS secretary_name TEXT;
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS admin_contact JSONB;  -- {name, number, email}
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS permit_portal TEXT;
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS assigned_engineers JSONB;  -- [{name, phone}]
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS contractors JSONB;  -- [{name, phone, scope}]
ALTER TABLE op_projects ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

-- ─── Add drive_file_id to existing tables ──────────────────────────────────────

ALTER TABLE hr_employee_documents ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE hr_payslips ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE ct_contracts ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

-- ─── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON drive_files
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON drive_sync_state
  FOR ALL USING (true) WITH CHECK (true);
