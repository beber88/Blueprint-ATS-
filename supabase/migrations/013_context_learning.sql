-- Context Learning: knowledge base + AI questions for the Operations module
-- Enables the system to learn abbreviations, entity mappings, and patterns from report ingestion

-- Enable trigram extension for fuzzy text search (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Knowledge Base ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_context_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type    TEXT NOT NULL CHECK (entry_type IN ('abbreviation','entity_mapping','project_phase','pattern','general')),
  trigger_text  TEXT NOT NULL,
  resolution    TEXT NOT NULL,
  scope_project_id    UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  scope_department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  confidence    NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  source        TEXT NOT NULL CHECK (source IN ('admin_explanation','question_answer','auto_pattern')),
  source_draft_id     UUID REFERENCES op_report_drafts(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast trigram search on trigger text
CREATE INDEX IF NOT EXISTS idx_op_context_entries_trigger
  ON op_context_entries USING gin (lower(trigger_text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_op_context_entries_type
  ON op_context_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_op_context_entries_active
  ON op_context_entries(is_active) WHERE is_active = TRUE;

-- ─── AI-Generated Questions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_context_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        UUID NOT NULL REFERENCES op_report_drafts(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_text_en TEXT,
  context_snippet TEXT,
  suggested_type  TEXT CHECK (suggested_type IS NULL OR suggested_type IN ('abbreviation','entity_mapping','project_phase','pattern','general')),
  suggested_trigger TEXT,
  answer_text     TEXT,
  resolved_context_entry_id UUID REFERENCES op_context_entries(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_op_context_questions_draft
  ON op_context_questions(draft_id);

CREATE INDEX IF NOT EXISTS idx_op_context_questions_status
  ON op_context_questions(status) WHERE status = 'pending';

-- ─── Alter Drafts: add questions column ────────────────────────────────────────

ALTER TABLE op_report_drafts
  ADD COLUMN IF NOT EXISTS questions_json JSONB DEFAULT '[]'::jsonb;

-- ─── RLS (match existing ops pattern — service-role only) ──────────────────────

ALTER TABLE op_context_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_context_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON op_context_entries
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON op_context_questions
  FOR ALL USING (true) WITH CHECK (true);

-- ─── RPC: atomic increment for usage tracking ─────────────────────────────────

CREATE OR REPLACE FUNCTION increment_context_usage(entry_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE op_context_entries
  SET usage_count = usage_count + 1,
      last_used_at = now(),
      updated_at = now()
  WHERE id = entry_id;
$$;
