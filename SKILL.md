# Blueprint HR - Claude Code Knowledge Base (SKILL.md)

Place this file at the root of the project: `/SKILL.md`
Claude Code will read it automatically on every session.

---

## 1. PROJECT IDENTITY

- **Name:** Blueprint HR (an HR System; the existing app is the **Recruitment** module)
- **Module URL prefix:** `/hr/recruitment/*` (rewrites map to legacy `/dashboard`, `/candidates`, etc.)
- **Company:** Blueprint Building Group Inc. (construction, Philippines)
- **Live URL:** https://blueprint-ats.vercel.app
- **Purpose:** HR platform - currently the Recruitment module is live; additional HR modules (employees, payroll, attendance, performance) to be added per upcoming spec
- **Users:** 3 users (Beber - CEO/Admin, Nicx - HR Recruiter, Rose - Secretary/Recruiter)
- **Languages:** Hebrew (RTL, primary), English, Tagalog

## 2. TECH STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 (App Router) + TypeScript | Use `app/` directory |
| Styling | Tailwind CSS + shadcn/ui | Custom design system, see section 8 |
| Fonts | Inter + Plus Jakarta Sans | Google Fonts |
| Database | Supabase PostgreSQL | Project: `blueprint-ats`, Region: West Europe |
| Storage | Supabase Storage | Bucket: `candidates` |
| Auth | Supabase Auth | Email/password + Google OAuth |
| AI | Anthropic Claude API (Sonnet) | CV parsing, scoring, classification |
| Email | Gmail OAuth2 | Send from company Gmail |
| WhatsApp | Twilio WhatsApp Business API | Send templates to candidates |
| Deployment | Vercel | Project: `beber88s-projects/blueprint-ats` |
| Realtime | Supabase Realtime | Enabled on chat_messages, chat_participants |

**Supabase URL:** `https://dmujasicwzhcvsossacx.supabase.co`

## 3. CRITICAL TECHNICAL RULES (BUGS THAT WERE FIXED - DO NOT REINTRODUCE)

### 3.1 pdf-parse
MUST use v1.1.1 with this exact import:
```typescript
const pdfParse = require('pdf-parse/lib/pdf-parse');
```
NEVER use the default import `require('pdf-parse')` - v2 requires `@napi-rs/canvas` which does NOT exist in Vercel serverless. This causes `DOMMatrix is not defined` errors.

### 3.2 Supabase Storage Policies
Always use `DROP POLICY IF EXISTS` before `CREATE POLICY`:
```sql
DROP POLICY IF EXISTS "policy_name" ON storage.objects;
CREATE POLICY "policy_name" ON storage.objects ...;
```
Without the DROP, re-running SQL creates duplicate policy errors.

### 3.3 Supabase Realtime
Must explicitly enable per table:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE tablename;
```
Without this, Realtime subscriptions silently receive nothing.

### 3.4 Supabase SQL Editor
Paste raw SQL only. Markdown code fences (```) cause parse errors.

### 3.5 Vercel Timeout (Hobby Plan)
Current plan: Hobby (10 second function timeout).
- Upload ONE file per API call, never batch
- Use filename-based classification shortcut for obvious CVs/portfolios
- Limit PDF parsing to 5 pages max (`{ max: 5 }`)
- Add `export const maxDuration = 10;` to API routes
- For long operations (auto-classify), process in batches of 3 with 2s delay

### 3.6 Translation Rules
- NEVER do partial word replacement in job titles. Either translate the FULL title or return original English. "Architectural Designer" must NOT become "ural Designerאדריכל"
- translateJobTitle: exact match first, then return original if no match
- Company names and school names NEVER get translated (proper nouns)
- All translations are display-only. Database always stores English

### 3.7 Candidate Names from Filenames
When parsing CV fails to extract a name, clean the filename:
- Remove .pdf/.docx extension
- Replace underscores with spaces
- Remove words: resume, cv, curriculum, vitae, portfolio, year numbers
- Validate result is a reasonable name (2-100 chars, no file extensions)

### 3.8 File Input in React
Use ref-based approach for file inputs to handle z-index and pointer-events:
```typescript
const fileInputRef = useRef<HTMLInputElement>(null);
// For folder upload, set webkitdirectory via ref after mount
useEffect(() => {
  if (folderInputRef.current) {
    folderInputRef.current.setAttribute('webkitdirectory', '');
  }
}, []);
```

## 4. DATABASE SCHEMA

### Core Tables
```
candidates          - Main candidate records
jobs                - Job postings
applications        - Candidate-job links with AI scores
interviews          - Scheduled interviews
activity_log        - All actions on candidates
message_templates   - Email/WhatsApp templates
messages_sent       - Sent message history
```

### File Management
```
candidate_files     - AI-classified documents (cv, portfolio, certificate, etc.)
```

### User Management
```
user_profiles       - User profiles (linked to auth.users)
                      Columns: id, email, full_name, role, is_active, job_board_credentials
                      Roles: admin, recruiter, viewer (TEXT with CHECK constraint)
```

### Chat System
```
chat_conversations  - Direct or group conversations
chat_participants   - Who is in each conversation
chat_messages       - Messages with type: text, candidate_share, file_share, ai_analysis_share, status_update, system
```

### Job Matching
```
job_requirements    - Detailed requirements per job (skills, experience, weights)
candidate_job_matches - AI evaluation of candidates against specific jobs
```

### Filters
```
saved_filters       - User-saved filter presets
```

### Key Candidate Columns
```
full_name, email, phone, skills[], experience_years, education,
certifications[], previous_roles JSONB, cv_raw_text, cv_file_url,
profession, profession_confidence, profession_source,
has_portfolio, portfolio_url, age, date_of_birth, nationality,
salary_expectation, overall_ai_score, ai_recommendation,
status, notes
```

### Status Values
```
new, reviewed, shortlisted, interview_scheduled, interviewed,
approved, rejected, keep_for_future
```

### Profession Values (stored in DB)
```
architect_licensed, architect, architect_intern, project_manager,
site_engineer, engineer_civil, engineer_electrical,
engineer_mechanical, engineer_mep, engineer_structural,
quantity_surveyor, procurement, supervisor,
construction_worker, admin, marketing, hr, finance, other
```

## 5. SIDEBAR NAVIGATION STRUCTURE

```
Main:           Dashboard, Candidates, Jobs, Interviews
Communication:  Chat, Messages, Templates
Tools:          AI Assistant, Professions, Guide
Management:     Unmatched Files, Settings, Job Boards, Users (admin only)
```

## 6. RBAC (Role-Based Access Control)

| Action | Admin | Recruiter | Viewer |
|--------|-------|-----------|--------|
| View candidates & dashboard | Yes | Yes | Yes |
| Upload CVs and files | Yes | Yes | No |
| Edit candidates & notes | Yes | Yes | No |
| Change candidate status | Yes | Yes | No |
| Send messages | Yes | Yes | No |
| Schedule interviews | Yes | Yes | No |
| Use team chat | Yes | Yes | Yes |
| Delete candidates | Yes | No | No |
| Manage users | Yes | No | No |
| System settings | Yes | No | No |

### Team Members
- **Beber** (CEO): ceo@blueprint-ph.com - Admin
- **Nicx** (HR Manager): hr@blueprint-ph.com - Recruiter, phone: +639542807121
- **Rose** (Secretary): roseanne.penaflor8612@gmail.com - Recruiter, phone: +639673351409

## 7. AI USAGE PATTERNS

### CV Parsing (on upload)
- Model: claude-sonnet-4-20250514
- Max tokens: 1000
- Input: first 3000 chars of extracted text
- Output: JSON with full_name, email, phone, skills, experience_years, education, certifications, previous_roles, detected_job_category

### Document Classification (on upload)
- Classifies as: cv, portfolio, certificate, reference_letter, id_document, cover_letter, other
- Uses filename shortcut first (if name contains "CV" or "Portfolio", skip AI)
- Falls back to AI only for ambiguous files

### Profession Classification (batch)
- Endpoint: /api/maintenance/classify-professions
- Builds context from: cv_raw_text OR skills + previous_roles + education + certifications
- Processes in batches of 3, 2s delay between batches
- Stores: profession, profession_confidence, profession_source

### Job Matching (on demand)
- Endpoint: /api/jobs/[id]/match-candidates
- Scores all candidates against specific job requirements
- Returns: total_score, category scores, strengths, weaknesses, recommendation, interview_questions

### AI Questionnaire (on demand)
- Endpoint: /api/jobs/[id]/questionnaire
- Generates role-specific questions to define job requirements
- Questions are tailored to construction industry in Philippines

## 8. DESIGN SYSTEM

### Colors (CSS Variables)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| --brand-gold | #C9A84C | #C9A84C | Accent, active states, scores |
| --bg-primary | #FFFFFF | #1E1E1E | Page background |
| --bg-card | #FFFFFF | #252525 | Cards, panels |
| --bg-secondary | #FAF8F5 | #252525 | Subtle backgrounds |
| --bg-tertiary | #F5F0E8 | #2A2A2A | Warm tinted sections |
| --text-primary | #1A1A1A | #F0EDE6 | Main text |
| --text-secondary | #6B6356 | #9A8E7A | Muted text |
| --text-tertiary | #8A7D6B | #7A7060 | Hints, timestamps |
| --border-primary | #E5E0D5 | #3A3A3A | Dividers, card borders |

### Sidebar: ALWAYS dark (#1A1A1A) regardless of light/dark theme

### Status Colors (CSS variables for both modes)
```
--status-new-bg / --status-new-text
--status-reviewed-bg / --status-reviewed-text
--status-shortlisted-bg / --status-shortlisted-text
--status-interview-bg / --status-interview-text
--status-approved-bg / --status-approved-text
--status-rejected-bg / --status-rejected-text
--status-future-bg / --status-future-text
```

### Typography
- Body: Inter 400, 14px
- Headings: Plus Jakarta Sans 600
- Hebrew: direction: rtl on html[lang="he"]
- Gold accent (#C9A84C) for highlights, NOT blue

## 9. I18N SYSTEM

Custom context-based (NOT next-intl):
- Files: messages/he.json, messages/en.json, messages/tl.json
- Provider: lib/i18n/context.tsx (I18nProvider + useI18n hook)
- Language stored in localStorage
- Content translation: lib/i18n/content-translations.ts
  - translateSkill(skill, lang)
  - translateJobTitle(title, lang) - NEVER partial replace
  - translateEducation(education, lang)
  - translateCertification(cert, lang)
  - translateExperience(years, lang)
- Profession labels: lib/i18n/profession-labels.ts
  - getProfessionLabel(profession, lang)

## 10. FILE UPLOAD FLOW

1. User selects files or folder (multiple supported)
2. Frontend sends ONE file per API call (prevents timeout)
3. API extracts text (pdf-parse v1.1.1, max 10 pages)
4. Filename shortcut: if name contains "CV"/"Resume" -> skip AI classification
5. AI classifies document type if ambiguous
6. For CVs: AI extracts candidate data, creates/updates candidate record
7. For portfolios/certificates: AI matches to existing candidate by name
8. File stored in Supabase Storage
9. Record saved in candidate_files table
10. Progress shown per-file with results summary

## 11. CHAT SYSTEM

WhatsApp-style internal chat:
- Direct messages between team members
- Group conversations
- Share candidates, files, AI analyses directly in chat
- Polls every 5 seconds for new messages
- Unread badge in sidebar

Message types: text, candidate_share, file_share, ai_analysis_share, status_update, system

## 12. DEPLOYMENT

- **Build:** `npm run build` (fix all errors before deploy)
- **Deploy:** Push to `main` branch triggers auto-deploy on Vercel
- **Branch:** `claude/build-blueprint-ats-0wc1r` for development, merge to `main` for production
- **Environment variables:** managed via Vercel Dashboard, NOT in code

### Required ENV vars:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER_EMAIL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
```

## 13. COMMON OPERATIONS

### Add a new page
1. Create file in `app/(main)/newpage/page.tsx`
2. Add to sidebar navGroups in `components/shared/sidebar.tsx`
3. Add i18n keys to all 3 language files
4. Use `useI18n()` for translations
5. Use CSS variables for all colors

### Add a new API route
1. Create in `app/api/routename/route.ts`
2. Use `createAdminClient()` from `@/lib/supabase/admin` for DB access
3. Add `export const dynamic = "force-dynamic";`
4. Add error handling with console.error
5. Return NextResponse.json()

### Add a new DB table
1. Write CREATE TABLE SQL
2. Add RLS policies (DROP IF EXISTS + CREATE)
3. Enable Realtime if needed
4. Run via Supabase MCP tool (execute_sql)

### Add translations
1. Add key to messages/he.json, messages/en.json, messages/tl.json
2. Use t('key') in components via useI18n()
3. For candidate content: use translateSkill/translateJobTitle functions

## 14. KNOWN ISSUES & WORKAROUNDS

| Issue | Workaround |
|-------|-----------|
| Vercel 10s timeout on upload | Process ONE file per API call |
| pdf-parse v2 breaks on Vercel | Use `require('pdf-parse/lib/pdf-parse')` |
| Partial job title translation | Return original text if no exact match |
| Filename as candidate name | Clean filename, remove extension/keywords |
| Filters don't work | fetchCandidates must use ONLY advancedFilters state |
| "Database error querying schema" | user_profiles.role must be TEXT not ENUM |
| Raw i18n key displayed | Use getProfessionLabel() not t("job_categories.*") |
| Unclassified candidates | classify-professions builds context from skills+roles if no cv_raw_text |
