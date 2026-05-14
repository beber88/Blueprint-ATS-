-- Blueprint HR — Contracts module: folder hierarchy for Google-Drive-style
-- contract organisation. Folders can nest arbitrarily; each contract may
-- optionally belong to one folder.
--
-- IDEMPOTENT — SAFE TO RE-RUN.

-- ─────────────────────────────────────────────────────────────────────────────
-- ct_folders — hierarchical folder tree (self-referencing via parent_id)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ct_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES ct_folders(id) ON DELETE CASCADE,
  color TEXT,                       -- optional hex accent, e.g. '#C9A84C'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_folders_parent_id
  ON ct_folders(parent_id);

-- Prevent duplicate folder names at the same level.
-- COALESCE maps NULL parent_id (root) to the nil UUID so the unique
-- constraint works uniformly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ct_folders_unique_name_per_parent
  ON ct_folders(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), lower(name));

-- ─────────────────────────────────────────────────────────────────────────────
-- Add folder_id to ct_contracts
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_contracts' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE ct_contracts
      ADD COLUMN folder_id UUID REFERENCES ct_folders(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_ct_contracts_folder_id
  ON ct_contracts(folder_id) WHERE folder_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirror the rest of the platform (see 008_contracts_schema.sql)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ct_folders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_folders'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON ct_folders
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_folders'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON ct_folders
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL function: get_folder_breadcrumbs — walk the parent chain and return
-- an ordered array from the root ancestor down to the given folder.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_folder_breadcrumbs(folder_uuid UUID)
RETURNS TABLE(id UUID, name TEXT) AS $$
  WITH RECURSIVE ancestors AS (
    SELECT f.id, f.name, f.parent_id, 0 AS depth
      FROM ct_folders f
     WHERE f.id = folder_uuid
    UNION ALL
    SELECT p.id, p.name, p.parent_id, a.depth + 1
      FROM ct_folders p
      JOIN ancestors a ON a.parent_id = p.id
  )
  SELECT ancestors.id, ancestors.name
    FROM ancestors
   ORDER BY depth DESC;   -- root first, current folder last
$$ LANGUAGE sql STABLE;
