-- Blueprint HR — Contracts module: schema for customer / subcontractor / vendor
-- contracts with the same draft-before-save pipeline used by Operations
-- (see migration 007 for the parent pattern).
--
-- IDEMPOTENT — SAFE TO RE-RUN.
--
-- Every CREATE POLICY / ADD CONSTRAINT / ADD COLUMN / storage policy is
-- wrapped in a DO $$ ... IF NOT EXISTS ... block (matching the migration-007
-- convention). Storage bucket via INSERT ... ON CONFLICT DO NOTHING.
-- scripts/a1-migration-sweep.js will fail CI with exit code 3 if any row
-- count drifts after re-applying this migration.
--
-- See docs/operations/preview-and-drafts.md for the drafts pipeline that
-- ct_contract_drafts mirrors.

-- ─────────────────────────────────────────────────────────────────────────────
-- ct_contracts — the real, query-able contract row (promoted from a draft)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ct_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL
    CHECK (category IN ('customer','subcontractor','vendor')),
  counterparty_name TEXT NOT NULL,
  counterparty_contact_name TEXT,
  counterparty_contact_email TEXT,
  counterparty_contact_phone TEXT,
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  signing_date DATE,
  effective_date DATE,
  expiration_date DATE,
  renewal_date DATE,
  monetary_value NUMERIC(14,2),
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  is_renewable BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','expired','terminated','renewed')),
  storage_path TEXT,
  -- Reserved for round 2 (obligations checklist extraction). Empty array
  -- in Spine. When populated: [{description, due_date, owner, status}, ...].
  obligations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  draft_source_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_contracts_category
  ON ct_contracts(category);
CREATE INDEX IF NOT EXISTS idx_ct_contracts_project_id
  ON ct_contracts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ct_contracts_expiration_date
  ON ct_contracts(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ct_contracts_renewal_date
  ON ct_contracts(renewal_date) WHERE is_renewable = TRUE;
CREATE INDEX IF NOT EXISTS idx_ct_contracts_status
  ON ct_contracts(status);
CREATE INDEX IF NOT EXISTS idx_ct_contracts_flagged
  ON ct_contracts(flagged_for_review) WHERE flagged_for_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_ct_contracts_counterparty_trgm
  ON ct_contracts USING gin (lower(unaccent(counterparty_name)) gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- ct_contract_drafts — every AI extraction begins here (mirror of
-- op_report_drafts from migration 007).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ct_contract_drafts (
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
  saved_contract_id UUID REFERENCES ct_contracts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ct_contract_drafts_status
  ON ct_contract_drafts(status);
CREATE INDEX IF NOT EXISTS idx_ct_contract_drafts_created_by_created_at
  ON ct_contract_drafts(created_by, created_at DESC);

-- FK from ct_contracts.draft_source_id → ct_contract_drafts(id) is added
-- AFTER ct_contract_drafts exists. ON DELETE SET NULL so deleting a draft
-- leaves the saved contract intact.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ct_contracts_draft_source_id_fkey'
  ) THEN
    ALTER TABLE ct_contracts
      ADD CONSTRAINT ct_contracts_draft_source_id_fkey
      FOREIGN KEY (draft_source_id)
      REFERENCES ct_contract_drafts(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ct_alerts — deadline / renewal alerts populated by the daily cron.
-- Partial unique constraint prevents the cron from creating duplicates
-- while an alert is still unresolved.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ct_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES ct_contracts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('expiring_soon','expired','renewal_window_open','payment_milestone_due')),
  severity TEXT NOT NULL
    CHECK (severity IN ('low','medium','high','urgent')),
  message TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_alerts_unresolved
  ON ct_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ct_alerts_contract
  ON ct_alerts(contract_id);

-- Idempotency for the cron: only one unresolved alert of a given type per
-- contract at a time. Lets the cron upsert via ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ct_alerts_unique_unresolved
  ON ct_alerts(contract_id, type) WHERE resolved_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirror the rest of the platform.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ct_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ct_contract_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ct_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_contracts'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON ct_contracts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_contracts'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON ct_contracts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_contract_drafts'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON ct_contract_drafts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_contract_drafts'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON ct_contract_drafts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_alerts'
      AND policyname = 'Allow authenticated access'
  ) THEN
    CREATE POLICY "Allow authenticated access" ON ct_alerts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ct_alerts'
      AND policyname = 'Allow service role access'
  ) THEN
    CREATE POLICY "Allow service role access" ON ct_alerts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for contract PDFs / scans. Private; downloads through
-- the API only.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'contracts: authenticated read'
  ) THEN
    CREATE POLICY "contracts: authenticated read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'contracts');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'contracts: authenticated insert'
  ) THEN
    CREATE POLICY "contracts: authenticated insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'contracts');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'contracts: service_role all'
  ) THEN
    CREATE POLICY "contracts: service_role all" ON storage.objects
      FOR ALL TO service_role
      USING (bucket_id = 'contracts') WITH CHECK (bucket_id = 'contracts');
  END IF;
END$$;
