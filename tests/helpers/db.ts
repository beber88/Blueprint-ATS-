import { Client } from "pg";
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");

// Connection string for the local Postgres test DB. Override via env.
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://bp_test:bp_test@localhost:5432/bp_test";

// Supabase-specific stubs so the production migrations apply unchanged.
// In a real Supabase project these are provided by the platform.
const SUPABASE_STUBS = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;

  -- Stock Postgres marks unaccent() STABLE (search_path-dependent dictionary
  -- lookup), but the index in migration 002 uses it in an IMMUTABLE-required
  -- context. Supabase's runtime makes this work via its extension layout; in
  -- our test harness we patch the function volatility so the index plants
  -- cleanly. This is a test-only patch; production migrations are unchanged.
  ALTER FUNCTION public.unaccent(text) IMMUTABLE;
  ALTER FUNCTION public.unaccent(regdictionary, text) IMMUTABLE;

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role;
    END IF;
  END$$;

  -- Supabase exposes auth.uid() / auth.role() / auth.jwt() in production.
  -- The test harness stubs them so RLS policies referencing auth.uid()
  -- can plant cleanly. Return NULL — RLS bodies are parsed but never
  -- executed in our test queries (we use direct service-role pg.Client
  -- connections which bypass RLS entirely).
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $auth$
    SELECT NULL::uuid;
  $auth$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $auth$
    SELECT NULL::text;
  $auth$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $auth$
    SELECT NULL::jsonb;
  $auth$;

  -- user_profiles is referenced by migration 011's RBAC helper but
  -- not created by any migration (it's bootstrapped manually in the
  -- Supabase project alongside auth). Stub it here so 011 + 012 can
  -- plant policies against it.
  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user'
  );
  ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='Allow authenticated access') THEN
      EXECUTE 'CREATE POLICY "Allow authenticated access" ON user_profiles FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE)';
    END IF;
  END $$;

  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public BOOLEAN DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT
  );
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
`;

const MIGRATION_FILES = [
  "001_initial_schema.sql",
  "002_operations_intelligence.sql",
  "003_operations_seed_real_data.sql",
  "004_operations_employees_history.sql",
  "005_operations_employee_lifecycle.sql",
  "006_operations_bulk_import_jobs.sql",
  "007_operations_drafts.sql",
  "008_contracts_schema.sql",
  "009_contract_folders.sql",
  "010_hr_modules.sql",
  "011_role_based_access.sql",
  "012_employee_profile_gapfill.sql",
];

async function dropAndRecreate(client: Client) {
  // Drop user schemas; keep system + extensions.
  await client.query(`
    DROP SCHEMA IF EXISTS storage CASCADE;
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO PUBLIC;
  `);
}

export async function freshClient(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  await dropAndRecreate(client);
  await client.query(SUPABASE_STUBS);
  for (const file of MIGRATION_FILES) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await client.query(sql);
    } catch (e) {
      const err = e as Error;
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }
  return client;
}

// Reset by re-running migrations on a wiped public schema. Some tests want
// to start from a fresh clean DB inside one suite.
export async function resetClient(client: Client): Promise<void> {
  await dropAndRecreate(client);
  await client.query(SUPABASE_STUBS);
  for (const file of MIGRATION_FILES) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await client.query(sql);
  }
}
