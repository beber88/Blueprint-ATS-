-- Blueprint ATS - i18n translation cache
-- Adds original_language + translations jsonb to every table that stores
-- user-visible free-text content. Pattern matches the existing
-- hr_employee_documents.original_language column (migration 002) and the
-- drive_files.original_language + translation_status columns (migration 003).
--
-- Render-side helpers (lib/i18n/get-localized.ts, components/shared/
-- LocalizedText.tsx) read translations[locale][field] and fall back to
-- the original column when no cached translation exists. Cache is
-- populated lazily by /api/translate/field on first view in a locale
-- that doesn't match original_language.
--
-- This migration is additive (ALTER TABLE ADD COLUMN IF NOT EXISTS) and
-- safe to re-run.

-- =====================================================================
-- ATS core tables (candidates, jobs, applications, interviews, templates)
-- =====================================================================

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS original_language TEXT
    CHECK (original_language IN ('he','en','tl','unknown'));
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS original_language TEXT
    CHECK (original_language IN ('he','en','tl','unknown'));
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- applications.ai_reasoning is Claude-generated. gen_locale records the
-- locale Claude was instructed to output in (the row is "native" in that
-- locale; render-side translates to other locales lazily).
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS gen_locale TEXT
    CHECK (gen_locale IN ('he','en','tl'));
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS original_language TEXT
    CHECK (original_language IN ('he','en','tl','unknown'));
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- message_templates are canonical English seed content; translations
-- cache populated on first send/preview in he or tl.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- =====================================================================
-- HR tables (hr_employee_documents already has original_language)
-- =====================================================================

ALTER TABLE hr_employee_documents
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- hr_employee_timeline: conduct/recognition/HR event records.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hr_employee_timeline'
  ) THEN
    EXECUTE 'ALTER TABLE hr_employee_timeline
      ADD COLUMN IF NOT EXISTS original_language TEXT
        CHECK (original_language IN (''he'',''en'',''tl'',''unknown''))';
    EXECUTE 'ALTER TABLE hr_employee_timeline
      ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT ''{}''::jsonb';
  END IF;
END $$;

-- =====================================================================
-- candidate_job_matches: scored matches with ai_reasoning, strengths,
-- weaknesses, interview_questions. Track which locale Claude generated
-- the row in plus a translations cache.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'candidate_job_matches'
  ) THEN
    EXECUTE 'ALTER TABLE candidate_job_matches
      ADD COLUMN IF NOT EXISTS gen_locale TEXT
        CHECK (gen_locale IN (''he'',''en'',''tl''))';
    EXECUTE 'ALTER TABLE candidate_job_matches
      ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT ''{}''::jsonb';
  END IF;
END $$;

-- =====================================================================
-- ct_contracts and drive_files: created outside the in-repo migrations
-- (referenced via lib/contracts/* and drive sync). Add columns only if
-- the table exists.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ct_contracts'
  ) THEN
    EXECUTE 'ALTER TABLE ct_contracts
      ADD COLUMN IF NOT EXISTS original_language TEXT
        CHECK (original_language IN (''he'',''en'',''tl'',''unknown''))';
    EXECUTE 'ALTER TABLE ct_contracts
      ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT ''{}''::jsonb';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drive_files'
  ) THEN
    EXECUTE 'ALTER TABLE drive_files
      ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT ''{}''::jsonb';
  END IF;
END $$;

-- =====================================================================
-- Indexes on original_language for analytics ("how many CVs arrived in
-- Hebrew this month") and to speed up native-skip queries.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_candidates_orig_lang ON candidates(original_language);
CREATE INDEX IF NOT EXISTS idx_jobs_orig_lang ON jobs(original_language);
CREATE INDEX IF NOT EXISTS idx_interviews_orig_lang ON interviews(original_language);
CREATE INDEX IF NOT EXISTS idx_applications_gen_locale ON applications(gen_locale);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'candidate_job_matches'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_gen_locale ON candidate_job_matches(gen_locale)';
  END IF;
END $$;
-- Add candidate_job_matches to the whitelist in lib/i18n/translate-field.ts
-- if you wire on-demand translation for ai_reasoning.
