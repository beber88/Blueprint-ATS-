-- Blueprint HR — Operations Intelligence Module
-- Adds the second module under the Blueprint HR umbrella alongside Recruitment.
-- All tables prefixed `op_` to namespace from existing recruitment tables.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─────────────────────────────────────────────────────────────────────────────
-- Master tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_he TEXT,
  name_en TEXT,
  name_tl TEXT,
  color TEXT DEFAULT '#C9A84C',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS op_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  started_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS op_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  whatsapp_phone TEXT UNIQUE,
  email TEXT,
  role TEXT,
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  is_pm BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  user_profile_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Reports + items
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS op_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf','whatsapp','text','image')),
  raw_text TEXT,
  source_meta JSONB DEFAULT '{}'::jsonb,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_by_phone TEXT,
  submitted_by_user_id UUID,
  submitted_by_employee_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  storage_path TEXT,
  processing_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (processing_status IN ('queued','processing','completed','failed')),
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Idempotency for Twilio retries: same MessageSid → never duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_op_reports_twilio_sid
  ON op_reports ((source_meta->>'twilio_message_sid'))
  WHERE source_type = 'whatsapp';

CREATE TABLE IF NOT EXISTS op_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES op_reports(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  department_raw TEXT,
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  project_raw TEXT,
  person_responsible_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  person_responsible_raw TEXT,
  person_responsible_match_confidence NUMERIC(4,3),
  issue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','blocked','resolved')),
  deadline DATE,
  deadline_raw TEXT,
  deadline_uncertain BOOLEAN DEFAULT FALSE,
  missing_information TEXT,
  ceo_decision_needed BOOLEAN DEFAULT FALSE,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  next_action TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('hr','attendance','safety','project','permit','procurement','subcontractor','site','other')),
  extra JSONB DEFAULT '{}'::jsonb,
  history JSONB DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS op_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES op_report_items(id) ON DELETE CASCADE,
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('overdue','missing_report','repeated','critical')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','urgent')),
  message TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS op_inbox_unmatched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  body TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  twilio_message_sid TEXT UNIQUE,
  claimed_employee_id UUID REFERENCES op_employees(id) ON DELETE SET NULL,
  resulting_report_id UUID REFERENCES op_reports(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS op_recurring_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL,
  sample_issues TEXT[],
  project_id UUID REFERENCES op_projects(id) ON DELETE SET NULL,
  department_id UUID REFERENCES op_departments(id) ON DELETE SET NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_op_report_items_report_date ON op_report_items(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_op_report_items_deadline ON op_report_items(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_op_report_items_priority_status ON op_report_items(priority, status);
CREATE INDEX IF NOT EXISTS idx_op_report_items_project ON op_report_items(project_id);
CREATE INDEX IF NOT EXISTS idx_op_report_items_department ON op_report_items(department_id);
CREATE INDEX IF NOT EXISTS idx_op_report_items_ceo ON op_report_items(ceo_decision_needed) WHERE ceo_decision_needed = TRUE;
CREATE INDEX IF NOT EXISTS idx_op_report_items_category ON op_report_items(category);
CREATE INDEX IF NOT EXISTS idx_op_report_items_issue_trgm
  ON op_report_items USING gin (lower(unaccent(issue)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_op_reports_report_date ON op_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_op_reports_status ON op_reports(processing_status);
CREATE INDEX IF NOT EXISTS idx_op_reports_employee ON op_reports(submitted_by_employee_id);

CREATE INDEX IF NOT EXISTS idx_op_alerts_unresolved ON op_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_op_alerts_type ON op_alerts(type);

CREATE INDEX IF NOT EXISTS idx_op_employees_whatsapp ON op_employees(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_op_employees_active ON op_employees(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Views
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW op_attendance_v AS
SELECT
  ri.id,
  ri.report_id,
  ri.report_date,
  ri.person_responsible_id AS employee_id,
  ri.person_responsible_raw AS employee_name,
  ri.department_id,
  ri.project_id,
  ri.status,
  ri.priority,
  ri.issue,
  ri.next_action,
  ri.created_at
FROM op_report_items ri
WHERE ri.category = 'attendance';

CREATE OR REPLACE VIEW op_overdue_v AS
SELECT
  ri.*,
  (CURRENT_DATE - ri.deadline) AS days_overdue
FROM op_report_items ri
WHERE ri.deadline IS NOT NULL
  AND ri.deadline < CURRENT_DATE
  AND ri.status <> 'resolved';

CREATE OR REPLACE VIEW op_missing_reports_v AS
SELECT p.id AS project_id, p.name AS project_name, p.department_id
FROM op_projects p
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM op_report_items ri
    WHERE ri.project_id = p.id
      AND ri.report_date = (CURRENT_DATE - INTERVAL '1 day')::date
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (mirrors recruitment pattern)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE op_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_inbox_unmatched ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_recurring_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access" ON op_departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_report_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_inbox_unmatched FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON op_recurring_themes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role access" ON op_departments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_report_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_inbox_unmatched FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON op_recurring_themes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for operations PDFs/images (private)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('operations-reports', 'operations-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated read ops reports" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'operations-reports');
CREATE POLICY "Allow authenticated upload ops reports" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operations-reports');
CREATE POLICY "Allow service role all ops reports" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'operations-reports') WITH CHECK (bucket_id = 'operations-reports');

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: a default department + sample project so the UI is not empty on first run
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO op_departments (code, name, name_he, name_en, name_tl, color) VALUES
  ('hr',          'משאבי אנוש',  'משאבי אנוש',  'HR',           'HR',           '#C9A84C'),
  ('site',        'אתר',          'אתר',          'Site',         'Site',         '#3D8A7D'),
  ('procurement', 'רכש',          'רכש',          'Procurement',  'Pagkuha',      '#5B3F9E'),
  ('finance',     'כספים',        'כספים',        'Finance',      'Pananalapi',   '#1A56A8'),
  ('engineering', 'הנדסה',        'הנדסה',        'Engineering',  'Engineering',  '#A88B3D'),
  ('safety',      'בטיחות',       'בטיחות',       'Safety',       'Kaligtasan',   '#A32D2D')
ON CONFLICT (code) DO NOTHING;
