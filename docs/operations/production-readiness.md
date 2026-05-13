# Production Readiness — Operations Intelligence

What an operator needs to know to take this module live, what to do
when something goes wrong, and what to watch in the first 48 hours.

Last verified: 2026-05-13 against branch `claude/refactor-recruitment-hr-56l9S`
at commit `b101b52` + post-cmd-7 defensive fixes.

## 1. Required environment variables

Group them by where they live (Vercel / Supabase / Twilio):

### Vercel project env

| var | required? | example | purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | `sk-ant-…` | Claude API key for `extract-report.ts` + image OCR + AI agent. |
| `OPERATIONS_DIGEST_SECRET` | **yes** | random 32+ char hex | HMAC for tokenized daily-digest links in email/WhatsApp. |
| `CRON_SECRET` | **yes** | random 32+ char hex | Bearer token Vercel cron sends in `Authorization` header. |
| `OPERATIONS_CEO_EMAIL` | **yes** | `ceo@blueprint.com` | Recipient for daily digest email. |
| `OPERATIONS_CEO_WHATSAPP` | **yes** | `+9725xxxxxxxx` | Recipient phone for digest WhatsApp. |
| `NEXT_PUBLIC_APP_URL` | **yes** | `https://blueprint.vercel.app` | Public base URL stitched into digest links. |
| `BULK_IMPORT_MAX_REPORTS` | optional | `200` | Hard cap on reports per bulk batch (default 200). |
| `BULK_IMPORT_CONCURRENCY` | optional | `10` | Max concurrent Claude calls during bulk (default 10). |
| `BULK_IMPORT_DEDUP_WINDOW_HOURS` | optional | `24` | Lookback for hash-based dedup (default 24). |

### Supabase env

| var | required? | source | purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | Supabase project settings | Public URL of the project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **yes** | Supabase project settings | Public anon key for client-side reads. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Supabase project settings | Service role for server-side writes (NEVER expose to client). |

### Twilio env

| var | required? | example | purpose |
|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | **yes** | `ACxxx…` | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | **yes** | (from Twilio console) | Used to verify inbound webhook signature. |
| `TWILIO_WHATSAPP_NUMBER` | **yes** | `whatsapp:+1415xxxxxxx` | The sandbox/production WhatsApp sender number. |
| `TWILIO_SKIP_SIGNATURE_VERIFICATION` | **dev-only** | `true` | Bypass signature check for local development. **MUST NOT be set in production.** |

## 2. Deploy order

Run these in this order. **Do not skip steps.**

```
1. Apply migrations 001 → 007 in order on the Supabase project.
2. Verify seed:
     SELECT COUNT(*) FROM op_departments;   -- expect 12
     SELECT COUNT(*) FROM op_projects;      -- expect 31
     SELECT COUNT(*) FROM op_employees WHERE is_active;  -- expect 27
     SELECT COUNT(*) FROM op_employees_history;          -- expect 15
3. Set Vercel env vars (section 1 above).
4. Deploy Vercel project (`vercel deploy --prod`).
5. Update Twilio webhook URL in Twilio console:
     https://<your-domain>/api/webhooks/twilio/whatsapp
   Method: POST. Twilio signature should be enabled (it is by default).
6. Configure Vercel cron (already in vercel.json) — verify the cron
   appears in the Vercel cron tab with the expected schedule.
7. Populate employee WhatsApp numbers via /hr/operations/employees.
8. Smoke test (sequential):
     a. POST to /api/operations/intake/extract with a sample report
        → expect 200 + draftId + warnings array.
     b. Open /hr/operations/intake/preview/<draftId> in a browser
        → verify three-column layout renders + warnings show.
     c. Click Save → verify op_reports row + items inserted.
     d. From a registered phone, send a WhatsApp to the production
        Twilio number → expect a TwiML ack within 15s.
     e. From an UNregistered phone, send a WhatsApp → expect 200 +
        "couldn't recognize this number" reply, no draft created.
     f. Forge POST to /api/webhooks/twilio/whatsapp with an invalid
        signature → expect 403, server log shows no payload.
```

## 3. Rollback procedures

The migrations are designed to be **forward-only**. We do NOT ship down
migrations because Supabase production migrations are difficult to safely
reverse once data has been written. If you must roll back:

### Per-migration rollback notes

| migration | safe rollback strategy |
|---|---|
| `007_operations_drafts.sql` | `DROP TABLE op_report_drafts CASCADE; ALTER TABLE op_reports DROP COLUMN flagged_for_review; ALTER TABLE op_reports DROP COLUMN draft_source_id; ALTER TABLE op_bulk_import_jobs DROP COLUMN auto_promote;` — destroys all unsaved drafts. Saved op_reports rows survive because `draft_source_id` is SET NULL on draft delete. |
| `006_operations_bulk_import_jobs.sql` | `DROP TABLE op_bulk_import_items CASCADE; DROP TABLE op_bulk_import_jobs CASCADE;` — destroys all bulk job history. Reports created via bulk survive (they were saved to `op_reports`). |
| `005_operations_employee_lifecycle.sql` | Drops a UNIQUE index + a FK column. Reverse: `DROP INDEX op_employees_full_name_active_key; ALTER TABLE op_employees_history DROP COLUMN employee_id;` Then restore the prior unique constraint if needed. |
| `004_operations_employees_history.sql` | `DROP TABLE op_employees_history;` — destroys separated-employee records. Re-seed manually from `samples/operations/employees_status.json`. |
| `003_operations_seed_real_data.sql` | Seed data only — to roll back, `TRUNCATE op_employees, op_projects, op_departments RESTART IDENTITY CASCADE;` then re-seed via the migration with corrected data. **This will cascade-delete any reports referencing these IDs.** |
| `002_operations_intelligence.sql` | Drop every `op_*` table (CASCADE). Destroys all operations data. |
| `001_initial_schema.sql` | Drop `jobs`, `candidates`, `cv_uploads`, `interviews` (CASCADE). Destroys all recruitment data. |

### Cleanest rollback

If you must reverse the entire deploy and start over:

```sql
DROP SCHEMA public CASCADE;
DROP SCHEMA storage CASCADE;
CREATE SCHEMA public;
-- Then re-apply Supabase's platform setup, then your migrations.
```

This is a nuclear option and destroys everything. Take a `pg_dump`
first.

## 4. Known limitations

These are decisions, not bugs. Each one is acceptable for the current
launch window — track them so the next person knows where to look.

### 4.1 Test harness pinned to `maxWorkers: 1`

`jest.config.js` runs tests serially. Background: parallel workers race
on `pg_extension_name_index` because extensions live in `pg_extension`
(outside `public`) and survive a schema drop. Today: ~89 tests in ~4s.
The right fix at ~200 tests is **schema-per-worker** — documented in
`docs/development/test-harness.md`.

### 4.2 Migrations 001 + 002 are NOT idempotent

Re-applying `001` or `002` against a schema that already has them fails
at `CREATE POLICY "Allow authenticated access"` (and similar). This is
fine because Supabase tracks applied migrations and never re-runs them
on production. Migrations 003 → 007 ARE idempotent (DO blocks +
IF NOT EXISTS guards) — verified in cmd 7 A1.

If you need to re-run 001 + 002 manually for any reason, drop the
policy first, or wrap the `CREATE POLICY` in a `DO $$ EXCEPTION WHEN
duplicate_object` block.

### 4.3 Legacy endpoints still in the codebase

These endpoints are unused by the UI but remain in `app/api/operations/`:
- `/api/operations/reports/ingest` — pre-draft single intake.
- `/api/operations/reports/bulk-ingest` — pre-draft bulk path.

They're left in place so an emergency operator can still hit them if
the draft pipeline fails for any reason. **Plan to remove these after
2 weeks of production use of the new pipeline** with no regressions.

### 4.4 PDF-only path on single intake

The single-intake `/api/operations/intake/extract` route accepts JSON
(text) and multipart (file + optional text). PDFs are parsed via
`pdf-parse/lib/pdf-parse.js` (lazy-required to avoid the package's
top-level side effect). Image-only PDFs (no embedded text) will fail —
falling back to OCR is a future enhancement.

### 4.5 promoteDraft normalizes invalid status/priority/category

`extract-report.ts` filters AI output; a hand-edit via PATCH could
historically smuggle an invalid status (e.g. `"closed"`) past the
helper into the items insert and hit a CHECK constraint. As of cmd 7
the helper normalizes invalid values to defaults (`open`, `medium`,
`other`). This is **defensive only** — covered by
`tests/draft-promote-validation.test.ts`.

### 4.6 UNKNOWN_PROJECT / UNKNOWN_EMPLOYEE false positives on Tagalog/English mix

Verification surfaced that names like "Adrian", "Joseph", "4 Storey"
(referenced in actual sample reports) don't match the seeded
`op_employees` / `op_projects`. This is a **seed-quality signal**: the
warning catalog is doing its job, but the master data may need
extension. The matcher uses substring + normalization (lowercase,
unaccent-aware via the master snapshot) — exotic transliterations may
miss. Reviewing one bulk job's UNKNOWN_* warnings tells you what to
add to the seed.

### 4.7 No retry workflow for failed bulk items

Bulk items that fail (Claude error, schema reject, etc.) stay
`status='failed'` with `error_message`. There's no UI button to
re-extract them. Operator workaround: copy the source text from
`op_bulk_import_items` and paste into single intake. A proper
`source_kind='retry'` workflow is deferred to a future commit.

## 5. Monitoring (first 48 hours)

Watch these four signals in Vercel + Supabase. None of them is alerting
out of the box — wire them through your existing monitoring if you
have one (Datadog, Better Stack, etc.).

### 5.1 Error rates

- **Vercel Functions tab** → filter by status >= 500.
  - Expect ~0/hour. Spikes suggest Claude API hiccups or schema drift.
- **Vercel Function logs** filtered to `signature verification failed`.
  - Expect 0 from Twilio (their signatures always pass). Anything non-zero
    is either an attacker probing or a misconfigured webhook URL.

### 5.2 AI cost trend

Track `op_bulk_import_jobs.estimated_cost_usd` over time:

```sql
SELECT date_trunc('hour', created_at) AS hour,
       SUM(estimated_cost_usd) AS total_estimated_usd,
       COUNT(*) AS jobs
FROM op_bulk_import_jobs
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY 1 ORDER BY 1;
```

The first 48h budget envelope: under $10 unless someone runs an
intentional historical backfill.

### 5.3 Draft accumulation

```sql
SELECT status, source_kind, COUNT(*)
FROM op_report_drafts
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY 1, 2;
```

Healthy: `saved` >> `draft + flagged`. If `draft` is growing
faster than `saved`, the operator isn't keeping up with the
Drafts inbox.

### 5.4 Twilio inbound failure modes

```sql
SELECT processing_status, COUNT(*)
FROM op_reports
WHERE source_type = 'whatsapp'
  AND created_at > NOW() - INTERVAL '48 hours'
GROUP BY 1;
```

`failed > 0` → likely Claude rejection of media OCR. Pull a sample row
and look at `source_meta`.

### 5.5 Name matcher noise — UNKNOWN_PROJECT / UNKNOWN_EMPLOYEE patterns

The matcher uses a short construction-domain stopword list
(`MATCHER_STOPWORDS` in `lib/operations/draft-warnings.ts`) — see
`docs/operations/preview-and-drafts.md` for the algorithm. In the first
48 hours, surface which raw strings keep firing the warnings:

```sql
SELECT
  jsonb_path_query_array(warnings_json, '$[*] ? (@.code == "UNKNOWN_PROJECT" || @.code == "UNKNOWN_EMPLOYEE").message_en') AS msgs,
  COUNT(*) AS n
FROM op_report_drafts
WHERE created_at > NOW() - INTERVAL '48 hours'
  AND jsonb_path_exists(warnings_json, '$[*] ? (@.code == "UNKNOWN_PROJECT" || @.code == "UNKNOWN_EMPLOYEE")')
GROUP BY 1
ORDER BY n DESC
LIMIT 30;
```

Look for repeat offenders. Each falls into one of three buckets:

- **Real seed gap** — the project / person genuinely isn't in the active
  master data. Action: add them to `op_projects` / `op_employees`.
- **Stopword gap** — a context word (e.g. `phase`, `block`, `tower`)
  appears in many real project mentions and is breaking the token-set
  match. Action: add it to `MATCHER_STOPWORDS` and write a short note in
  `preview-and-drafts.md` under "Warning catalog" explaining the
  trigger case. **Do not add Hebrew / Tagalog words yet** — PMs write
  reports in English. Cross that bridge if data shows otherwise.
- **Real name variance the matcher should catch** — e.g. transliteration
  ("Joseph" vs "Yauna Joseph"), nicknames, OCR errors. Action: file a
  backlog entry. Don't extend the matcher reactively under fire.

This is the explicit feedback loop for the matcher. The stopword list
is a heuristic — staging is where it earns its final shape.

## 6. Verified at cmd 7 (paste-able evidence)

| Subtask | Status | Evidence |
|---|---|---|
| Migration sweep 001→007, fresh apply | ✅ | `scripts/a1-migration-sweep.js` output: all 7 OK |
| Idempotency 003→007 (zero row drift) | ✅ | A1 output: `Drift (none)` |
| Idempotency 001+002 (expected failure) | ✅ documented | A1 output: `policy "Allow authenticated access" already exists` |
| `npm ci` clean install | ✅ | A2 output |
| `npm run build` | ✅ | `✓ Compiled successfully` |
| `npm test` | ✅ 89/89 | A2 output |
| Coverage on `lib/operations/*` | ✅ | 97.89% stmt / 100% lines / 88.37% branch / 100% func |
| E2E draft → warnings → save | ✅ simulated | `scripts/a3-e2e-simulated.ts` output |
| E2E draft → discard | ✅ simulated | same |
| Twilio webhook 403 on bad sig | ✅ | `tests/twilio-route-smoke.test.ts` (3 cases) |
| Twilio webhook log doesn't leak payload | ✅ | same |

Not verified by Claude Code (owner's responsibility):
- UI screenshots / manual browser testing.
- Real Claude API E2E (no `ANTHROPIC_API_KEY` in verification env).
- Real Supabase project deploy.
- Real Twilio production webhook configuration.

## 7. Open questions for the owner

1. Should we delete the legacy `/api/operations/reports/ingest` and
   `/api/operations/reports/bulk-ingest` endpoints now, or wait the
   recommended 2 weeks?
2. Is the 27-employee seed in `samples/operations/employees_status.json`
   the authoritative roster, or are there names (Adrian, Joseph from
   the sample reports) that need to be added to the seed before launch?
3. Auto-promote default — should it ship as off-by-default (current
   behavior) or should bulk-import jobs by default auto-promote drafts
   with zero high-severity warnings? Recommend keeping off-by-default
   until 1 week of production data shows the warning catalog calibration
   matches reality.
