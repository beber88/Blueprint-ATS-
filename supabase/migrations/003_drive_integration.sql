-- Blueprint HRIS - Phase 2: Google Drive integration tables
-- Per-user OAuth tokens (encrypted at app layer), sync state, and a
-- catalog of every Drive file we've seen for dedup + classification routing.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- drive_oauth_tokens: per-user, encrypted at the app layer.
-- =====================================================================
CREATE TABLE IF NOT EXISTS drive_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  google_email TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  scope TEXT,
  token_type TEXT,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_oauth_tokens_user ON drive_oauth_tokens(user_id);

ALTER TABLE drive_oauth_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drive_oauth_tokens' AND policyname = 'Service role only') THEN
    CREATE POLICY "Service role only" ON drive_oauth_tokens
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  -- Authenticated users can see only their own connection metadata (NOT the encrypted tokens themselves; API filters them out)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drive_oauth_tokens' AND policyname = 'Owner read own row') THEN
    CREATE POLICY "Owner read own row" ON drive_oauth_tokens
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- =====================================================================
-- drive_sync_state: one row per (user, root folder) sync job
-- =====================================================================
CREATE TABLE IF NOT EXISTS drive_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  root_folder_id TEXT NOT NULL,
  root_folder_name TEXT,
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle','running','paused','error','complete')),
  last_page_token TEXT,
  files_seen INTEGER DEFAULT 0,
  files_imported INTEGER DEFAULT 0,
  files_skipped INTEGER DEFAULT 0,
  files_errored INTEGER DEFAULT 0,
  files_duplicate INTEGER DEFAULT 0,
  cursor JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  last_progress_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drive_sync_state_user ON drive_sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_sync_state_status ON drive_sync_state(status);

ALTER TABLE drive_sync_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drive_sync_state' AND policyname = 'Allow authenticated access') THEN
    CREATE POLICY "Allow authenticated access" ON drive_sync_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drive_sync_state' AND policyname = 'Service role access') THEN
    CREATE POLICY "Service role access" ON drive_sync_state FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =====================================================================
-- drive_files: every Drive file we've enumerated, hashed, classified
-- =====================================================================
CREATE TABLE IF NOT EXISTS drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT NOT NULL UNIQUE,
  sync_state_id UUID REFERENCES drive_sync_state(id) ON DELETE SET NULL,
  parent_folder_path TEXT,
  parent_folder_id TEXT,
  name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  modified_time TIMESTAMPTZ,
  md5_checksum TEXT,
  file_hash TEXT,
  classification JSONB DEFAULT '{}'::jsonb,
  classification_status TEXT DEFAULT 'pending'
    CHECK (classification_status IN ('pending','classified','routed','duplicate','failed','skipped')),
  document_type TEXT,
  target_table TEXT,
  target_id UUID,
  target_employee_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  original_language TEXT CHECK (original_language IN ('he','en','tl','unknown')),
  translation_status TEXT DEFAULT 'none'
    CHECK (translation_status IN ('none','pending','done','failed')),
  error_log JSONB DEFAULT '[]'::jsonb,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drive_files_sync_state ON drive_files(sync_state_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_status ON drive_files(classification_status);
CREATE INDEX IF NOT EXISTS idx_drive_files_hash ON drive_files(file_hash);
CREATE INDEX IF NOT EXISTS idx_drive_files_md5 ON drive_files(md5_checksum);
CREATE INDEX IF NOT EXISTS idx_drive_files_employee ON drive_files(target_employee_id);

ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drive_files' AND policyname = 'Allow authenticated access') THEN
    CREATE POLICY "Allow authenticated access" ON drive_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drive_files' AND policyname = 'Service role access') THEN
    CREATE POLICY "Service role access" ON drive_files FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
