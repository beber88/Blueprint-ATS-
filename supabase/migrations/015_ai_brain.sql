-- Blueprint HR — AI Brain Intelligence Engine
-- Adds tables for storing AI-generated insights and computed health scores.
-- IDEMPOTENT — SAFE TO RE-RUN.

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_brain_insights — AI-generated insights that persist between sessions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_brain_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL
    CHECK (type IN (
      'cost_saving','performance_alert','efficiency_tip','strategic',
      'risk_alert','attendance_pattern','training_gap','turnover_risk'
    )),
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  affected_employees UUID[] DEFAULT '{}',
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  data_snapshot JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','acknowledged','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX IF NOT EXISTS idx_hr_brain_insights_status_severity
  ON hr_brain_insights(status, severity);
CREATE INDEX IF NOT EXISTS idx_hr_brain_insights_type
  ON hr_brain_insights(type);
CREATE INDEX IF NOT EXISTS idx_hr_brain_insights_created
  ON hr_brain_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_brain_insights_dept
  ON hr_brain_insights(department_id) WHERE department_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_brain_scores — Cached health/efficiency scores for fast dashboard reads
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_brain_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL
    CHECK (scope IN ('company','department','employee')),
  scope_id UUID,
  score NUMERIC(5,1) NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_brain_scores_scope
  ON hr_brain_scores(scope);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — same pattern as migration 010
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE hr_brain_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_brain_scores   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access on hr_brain_insights" ON hr_brain_insights;
CREATE POLICY "Allow authenticated access on hr_brain_insights"
  ON hr_brain_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role access on hr_brain_insights" ON hr_brain_insights;
CREATE POLICY "Allow service role access on hr_brain_insights"
  ON hr_brain_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access on hr_brain_scores" ON hr_brain_scores;
CREATE POLICY "Allow authenticated access on hr_brain_scores"
  ON hr_brain_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role access on hr_brain_scores" ON hr_brain_scores;
CREATE POLICY "Allow service role access on hr_brain_scores"
  ON hr_brain_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
