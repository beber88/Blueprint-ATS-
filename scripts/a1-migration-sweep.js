const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://bp_test:bp_test@localhost:5432/bp_test";
const MIG_DIR = path.join(__dirname, "..", "supabase", "migrations");
const FILES = [
  "001_initial_schema.sql",
  "002_operations_intelligence.sql",
  "003_operations_seed_real_data.sql",
  "004_operations_employees_history.sql",
  "005_operations_employee_lifecycle.sql",
  "006_operations_bulk_import_jobs.sql",
  "007_operations_drafts.sql",
  "008_contracts_schema.sql",
];

const STUBS = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;
  ALTER FUNCTION public.unaccent(text) IMMUTABLE;
  ALTER FUNCTION public.unaccent(regdictionary, text) IMMUTABLE;
  DO $$ BEGIN
    CREATE ROLE authenticated;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE ROLE service_role;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT,
    public BOOLEAN DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT
  );
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
`;

const ALL_TABLES = [
  "profiles", "jobs", "candidates", "cv_uploads", "interviews",
  "op_departments", "op_projects", "op_employees",
  "op_reports", "op_report_items",
  "op_employees_history",
  "op_bulk_import_jobs", "op_bulk_import_items",
  "op_report_drafts",
  "ct_contracts", "ct_contract_drafts", "ct_alerts",
];

async function counts(c) {
  const out = {};
  for (const t of ALL_TABLES) {
    try {
      const r = await c.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      out[t] = r.rows[0].c;
    } catch {
      out[t] = -1;
    }
  }
  return out;
}

function fmt(c) {
  return ALL_TABLES.map(
    (t) => `  ${t.padEnd(28)} = ${c[t] >= 0 ? c[t] : "MISSING"}`
  ).join("\n");
}

async function applyFile(c, name) {
  const sql = fs.readFileSync(path.join(MIG_DIR, name), "utf8");
  try {
    await c.query(sql);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  const c = new Client({ connectionString: URL });
  await c.connect();

  console.log("=== A1: clean schema + apply 001..008 ===");
  await c.query("DROP SCHEMA IF EXISTS storage CASCADE");
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");
  await c.query(STUBS);
  console.log("Schema reset (public + storage dropped).\n");

  for (const f of FILES) {
    const r = await applyFile(c, f);
    console.log(`  ${f}: ${r.ok ? "OK" : "FAILED — " + r.error}`);
    if (!r.ok) {
      await c.end();
      // Exit 2 = initial apply broke. Hard CI fail.
      process.exit(2);
    }
  }
  console.log("\n=== Row counts after fresh apply ===");
  const c1 = await counts(c);
  console.log(fmt(c1));

  console.log("\n=== A1: idempotency re-run of 003..008 ===");
  let rerunFailed = false;
  for (const f of FILES.slice(2)) {
    const r = await applyFile(c, f);
    console.log(`  ${f}: ${r.ok ? "OK" : "FAILED — " + r.error.split("\n")[0]}`);
    if (!r.ok) rerunFailed = true;
  }
  console.log("\n=== Row counts after 003..008 re-run ===");
  const c2 = await counts(c);
  console.log(fmt(c2));

  const drift = [];
  for (const t of ALL_TABLES) {
    if (c1[t] !== c2[t]) drift.push(`${t}: ${c1[t]} -> ${c2[t]}`);
  }
  console.log("\n=== Drift (should be empty) ===");
  console.log(drift.length === 0 ? "  (none)" : drift.map((d) => "  " + d).join("\n"));

  // 001+002 re-run failures are KNOWN AND EXPECTED — documented in
  // production-readiness.md §4.2. We log them for visibility but the CI
  // gate doesn't care.
  console.log("\n=== A1: re-run of 001 + 002 (CREATE POLICY etc. expected to fail) ===");
  for (const f of FILES.slice(0, 2)) {
    const r = await applyFile(c, f);
    console.log(`  ${f}: ${r.ok ? "OK (unexpected)" : "FAILED — " + r.error.split("\n")[0]}`);
  }

  await c.end();

  // Gates the CI cares about (in order of severity):
  if (rerunFailed) {
    console.error("\nFAIL: at least one of migrations 003..008 broke on re-run.");
    // Exit 4 = idempotency lost. Hard CI fail.
    process.exit(4);
  }
  if (drift.length > 0) {
    console.error("\nFAIL: row counts drifted after re-running migrations 003..008.");
    console.error("These migrations must be re-runnable without changing row counts.");
    // Exit 3 = silent data drift. Hard CI fail.
    process.exit(3);
  }
  console.log("\nOK: migrations 001..008 apply clean; 003..008 are idempotent.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
