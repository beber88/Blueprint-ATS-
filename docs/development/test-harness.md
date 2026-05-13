# Test Harness — Local Postgres vs. Supabase

The integration tests in `tests/employee-lifecycle.test.ts` (and any future
tests that touch the operations schema) run against a **real local Postgres
16 cluster**, not a mock. The harness lives in `tests/helpers/db.ts`.

This document explains the environment gaps between vanilla Postgres and
Supabase that the harness has to paper over. Read it before debugging a
locally-failing migration.

## Connection

```
TEST_DATABASE_URL  (default: postgresql://bp_test:bp_test@localhost:5432/bp_test)
```

The default points at a local Postgres 16 instance with a `bp_test`
superuser. Spin one up with:

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER bp_test WITH PASSWORD 'bp_test' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE bp_test OWNER bp_test;"
```

`tests/helpers/db.ts:freshClient()` drops & recreates the `public` schema,
applies the stub, then runs every migration in order.

## Gaps the stub fills

These are runtime differences between vanilla Postgres and Supabase's
managed environment. Production migrations are NEVER modified for them —
the workarounds live only in `tests/helpers/db.ts`.

### 1. The `authenticated` and `service_role` roles

Migrations use `GRANT … TO authenticated` and `… TO service_role` to scope
RLS policies. Supabase pre-creates these roles; vanilla Postgres does not.
The stub creates both as plain roles so policy definitions parse.

### 2. The `storage` schema

Migration `001_initial_schema.sql` and `002_operations_intelligence.sql`
both `INSERT INTO storage.buckets …` and `CREATE POLICY … ON storage.objects`.
Supabase ships `storage` as a managed extension with these tables already
there. Locally we create a minimal stub:

```sql
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN);
CREATE TABLE storage.objects (id UUID PRIMARY KEY, bucket_id TEXT REFERENCES storage.buckets(id), name TEXT);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

This is **only** enough for the bucket+policy DDL to plant. Tests don't
exercise storage I/O — that's an end-to-end concern.

### 3. `unaccent()` volatility

Migration `002_operations_intelligence.sql` builds a GIN trigram index:

```sql
CREATE INDEX idx_op_report_items_issue_trgm
  ON op_report_items USING gin (lower(unaccent(issue)) gin_trgm_ops);
```

Stock Postgres ships `unaccent(text)` as `STABLE` (its dictionary lookup
depends on `search_path`). Postgres refuses `STABLE` functions inside
index expressions, so locally the migration fails with:

```
ERROR: functions in index expression must be marked IMMUTABLE
```

Supabase's extension layout makes this work without intervention; in our
test harness we patch the function volatility after `CREATE EXTENSION
unaccent`:

```sql
ALTER FUNCTION public.unaccent(text) IMMUTABLE;
ALTER FUNCTION public.unaccent(regdictionary, text) IMMUTABLE;
```

This is a documented Postgres workaround for trigram-on-unaccent indexes.
It is safe as long as the `unaccent` dictionary doesn't change at runtime
(which it doesn't in our deployment).

## Non-idempotent migrations

Not every migration is safe to re-run. The matrix in
`supabase/migrations/README.md` is the source of truth. Currently:

- `001_initial_schema.sql` — **No.** Contains `CREATE POLICY` and `INSERT
  INTO storage.buckets` without conflict targets.
- `002_operations_intelligence.sql` — **No.** Same reason: many
  `CREATE POLICY` statements; Postgres has no `CREATE POLICY IF NOT
  EXISTS` syntax.
- `003`, `004`, `005`, `006` — **Yes.** All use `IF NOT EXISTS`, `DO $$`
  guards, `WHERE NOT EXISTS`, or `ON CONFLICT DO NOTHING`.

The lifecycle test (`seed migrations 003+004+005 are idempotent`) verifies
this contract.

## Running the tests

```bash
npm test                              # all tests
npm test -- --testNamePattern lifecycle   # just lifecycle
SKIP_DB_TESTS=true npm test          # skip DB tests (for CI without Postgres)
```
