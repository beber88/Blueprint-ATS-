-- System Reliability: cron run log + latent DB bug fixes
-- 1. system_runs — audit trail of every background job execution
-- 2. op_reports.source_type must accept 'email' (email-routed inserts were
--    silently rejected by the CHECK constraint from migration 002)
-- 3. op_reports.attempts — retry bookkeeping for the stuck-item sweeper
-- 4. op_context_questions: allow questions from the op_reports pipeline,
--    not only from drafts (draft_id was NOT NULL, so the learning loop
--    could never persist questions generated during report extraction)

-- ─── Cron / job execution log ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','success','partial','failed')),
  items_processed INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_runs_job
  ON system_runs(job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_runs_started
  ON system_runs(started_at DESC);

ALTER TABLE system_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON system_runs;
CREATE POLICY "service_role_all" ON system_runs
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Fix: op_reports must accept email-sourced reports ─────────────────────────

ALTER TABLE op_reports DROP CONSTRAINT IF EXISTS op_reports_source_type_check;
ALTER TABLE op_reports ADD CONSTRAINT op_reports_source_type_check
  CHECK (source_type IN ('pdf','whatsapp','text','image','email'));

-- ─── Retry bookkeeping for the sweeper ──────────────────────────────────────────

ALTER TABLE op_reports ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- ─── Fix: questions from the op_reports pipeline ────────────────────────────────

ALTER TABLE op_context_questions ALTER COLUMN draft_id DROP NOT NULL;

ALTER TABLE op_context_questions
  ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES op_reports(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_op_context_questions_report
  ON op_context_questions(report_id);
