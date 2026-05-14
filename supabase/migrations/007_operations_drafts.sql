-- Blueprint HR — Operations: Preview / Drafts pipeline
--
-- IDEMPOTENT — SAFE TO RE-RUN.
--
-- After this migration every AI extraction lands in a draft first. A
-- human (Preview UI) or an auto-promote policy moves the draft to a
-- real op_reports row. This keeps the AI's first output reviewable and
-- creates a single point where warnings can be raised before persistence.
--
-- See docs/operations/preview-and-drafts.md for the lifecycle.

-- ─────────────────────────────────────────────────────────────────────────────
-- op_report_drafts — every AI extraction begins here
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_report_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  ai_output_json JSONB NOT NULL,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','saved','flagged','discarded')),
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('manual','bulk','retry')),
  saved_report_id UUID REFERENCES op_reports(id) ON DELETE SET NULL,
  bulk_import_item_id UUID REFERENCES op_bulk_import_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_op_report_drafts_created_by_created_at
  ON op_report_drafts(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_report_drafts_status
  ON op_report_drafts(status);
CREATE INDEX IF NOT EXISTS idx_op_report_drafts_bulk_import_item
  ON op_report_drafts(bulk_import_item_id) WHERE bulk_import_item_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- op_reports — track which draft promoted to this report + manual flagging
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_reports
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE op_reports
  ADD COLUMN IF NOT EXISTS draft_source_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'op_reports_draft_source_id_fkey'
  ) THEN
    ALTER TABLE op_reports
      ADD CONSTRAINT op_reports_draft_source_id_fkey
      FOREIGN KEY (draft_source_id)
      REFERENCES op_report_drafts(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_op_reports_flagged_for_review
  ON op_reports(flagged_for_review) WHERE flagged_for_review = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- op_bulk_import_jobs — auto-promote flag (used by commit 2 / wings)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_bulk_import_jobs
  ADD COLUMN IF NOT EXISTS auto_promote BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirrors the rest of the op_* tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_report_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_report_drafts'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON op_report_drafts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_report_drafts'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON op_report_drafts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;
