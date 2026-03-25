-- Blueprint ATS - Initial Schema Migration
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department TEXT,
  description TEXT,
  requirements TEXT,
  location TEXT,
  employment_type TEXT DEFAULT 'full-time',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  linkedin_url TEXT,
  cv_file_url TEXT,
  cv_raw_text TEXT,
  skills TEXT[],
  experience_years INTEGER,
  education TEXT,
  certifications TEXT[],
  previous_roles JSONB DEFAULT '[]',
  notes TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new','reviewed','shortlisted','interview_scheduled',
    'interviewed','approved','rejected','keep_for_future'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate-Job applications
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  ai_reasoning TEXT,
  status TEXT DEFAULT 'new',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- Interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  interviewer TEXT,
  type TEXT DEFAULT 'in-person' CHECK (type IN ('in-person','video','phone')),
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('email','whatsapp')),
  category TEXT CHECK (category IN ('interview_invite','rejection','next_stage','offer','general')),
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sent messages log
CREATE TABLE IF NOT EXISTS messages_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id),
  template_id UUID REFERENCES message_templates(id),
  channel TEXT CHECK (channel IN ('email','whatsapp')),
  to_address TEXT,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_ai_score ON applications(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_candidate_id ON activity_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sent_candidate_id ON messages_sent(candidate_id);

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_sent ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users full access)
CREATE POLICY "Allow authenticated access" ON jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON applications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON interviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON messages_sent FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role full access (for API routes using admin client)
CREATE POLICY "Allow service role access" ON jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON applications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON interviews FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON message_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON messages_sent FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create storage bucket for CVs
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for CVs
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'cvs');
CREATE POLICY "Allow authenticated upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cvs');
CREATE POLICY "Allow service role upload" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'cvs');

-- Seed message templates
INSERT INTO message_templates (name, type, category, subject, body, variables) VALUES
(
  'Interview Invitation',
  'email',
  'interview_invite',
  'Interview Invitation - {{job_title}} | Blueprint',
  'Hello {{candidate_name}},

We are pleased to inform you that you have passed our initial screening and we would like to invite you for an interview for the position: {{job_title}}.

Proposed interview date: {{interview_date}} at {{interview_time}}
Location / Link: {{location}}

Please confirm your attendance by replying to this email.

Best regards,
Blueprint HR Team',
  ARRAY['candidate_name', 'job_title', 'interview_date', 'interview_time', 'location']
),
(
  'Polite Rejection',
  'email',
  'rejection',
  'Update regarding your application - Blueprint',
  'Hello {{candidate_name}},

Thank you very much for your interest in the {{job_title}} position and the effort you invested in the process.

After careful consideration, we have decided to proceed with other candidates whose skill profiles more closely match the specific requirements of the role at this time.

We would be happy to keep your details for future positions.

Best wishes,
Blueprint Team',
  ARRAY['candidate_name', 'job_title']
),
(
  'Next Stage Notification',
  'whatsapp',
  'next_stage',
  NULL,
  'Hello {{candidate_name}}!

This is the Blueprint team.
We are happy to inform you that you have moved to the next stage in the hiring process for the {{job_title}} position.
We will contact you soon to schedule the next steps.

Thank you and have a great day!',
  ARRAY['candidate_name', 'job_title']
),
(
  'Job Offer',
  'email',
  'offer',
  'Congratulations on your job offer - Blueprint',
  'Hello {{candidate_name}},

We are thrilled to let you know that we have decided to offer you the {{job_title}} position at Blueprint!

Start date: {{start_date}}
Direct manager: {{manager_name}}

We will send you all required documents for signing shortly.

Congratulations,
Blueprint Team',
  ARRAY['candidate_name', 'job_title', 'start_date', 'manager_name']
);
