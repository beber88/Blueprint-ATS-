-- Blueprint HR — Operations: Bulk Import Jobs + Items
--
-- IDEMPOTENT — SAFE TO RE-RUN.
--
-- Tracks every bulk-import batch as a job with per-report items so that:
--   - Cancel works mid-flight (worker checks job status before each item).
--   - Resume picks up where it left off after a deploy or crash.
--   - Duplicate batches are detected via source_text_hash before another
--     run incurs Claude tokens.
--
-- See docs/operations/bulk-import.md for the lifecycle.

-- ─────────────────────────────────────────────────────────────────────────────
-- Jobs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_bulk_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_reports INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','done','failed','cancelled')),
  cancelled_at TIMESTAMPTZ,
  source_text_hash TEXT NOT NULL,
  estimated_input_tokens INTEGER,
  estimated_output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10,4),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_op_bulk_import_jobs_status
  ON op_bulk_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_op_bulk_import_jobs_created_by_created_at
  ON op_bulk_import_jobs(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_bulk_import_jobs_source_text_hash
  ON op_bulk_import_jobs(source_text_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- Items — one per detected report inside the pasted batch
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_bulk_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES op_bulk_import_jobs(id) ON DELETE CASCADE,
  report_index INTEGER NOT NULL,
  date_extracted DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed','cancelled')),
  error_message TEXT,
  output_report_id UUID REFERENCES op_reports(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  ai_tokens_used INTEGER,
  ai_cost_usd NUMERIC(10,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'op_bulk_import_items_job_report_index_key'
  ) THEN
    ALTER TABLE op_bulk_import_items
      ADD CONSTRAINT op_bulk_import_items_job_report_index_key
      UNIQUE (job_id, report_index);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_op_bulk_import_items_job_status
  ON op_bulk_import_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_op_bulk_import_items_status
  ON op_bulk_import_items(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirrors the rest of the op_* tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_bulk_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_bulk_import_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_bulk_import_jobs'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON op_bulk_import_jobs
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_bulk_import_jobs'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON op_bulk_import_jobs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_bulk_import_items'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON op_bulk_import_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_bulk_import_items'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON op_bulk_import_items
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;
