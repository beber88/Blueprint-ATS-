import { Client } from "pg";
import { freshClient, resetClient } from "./helpers/db";

// Real integration tests against a local Postgres 16 cluster.
// Set TEST_DATABASE_URL to override the default connection string.
// Skipped automatically if the DB is unreachable.

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";

const d = RUN_DB_TESTS ? describe : describe.skip;

d("op_employees + op_employees_history lifecycle (real Postgres)", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    // Wipe just the two tables we touch; keep the seed data in place. Tests
    // that need to reset everything call resetClient() explicitly.
    await client.query("DELETE FROM op_employees_history WHERE full_name LIKE 'TEST_%'");
    await client.query("DELETE FROM op_employees WHERE full_name LIKE 'TEST_%'");
  });

  // ────────────────────────────────────────────────────────────────────────
  // Test 1: history row with employee_id = NULL is allowed
  // (matches the 15 seeded legacy rows from migration 004)
  // ────────────────────────────────────────────────────────────────────────
  it("allows op_employees_history rows with employee_id = NULL (legacy)", async () => {
    const { rows } = await client.query(`
      INSERT INTO op_employees_history (full_name, status, ended_at, employee_id)
      VALUES ('TEST_legacy_resigned', 'resigned', '2025-08-01', NULL)
      RETURNING id, employee_id;
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].employee_id).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Test 2: history row with employee_id pointing to an existing employee
  // ────────────────────────────────────────────────────────────────────────
  it("allows op_employees_history rows linked to an existing op_employees.id", async () => {
    const emp = await client.query(`
      INSERT INTO op_employees (full_name, role, is_active)
      VALUES ('TEST_linked_active', 'PM', TRUE)
      RETURNING id;
    `);
    const employeeId = emp.rows[0].id;

    const hist = await client.query(
      `INSERT INTO op_employees_history
         (full_name, status, ended_at, employee_id)
       VALUES ($1, 'resigned', $2, $3)
       RETURNING id, employee_id;`,
      ["TEST_linked_active", "2026-05-13", employeeId]
    );
    expect(hist.rows[0].employee_id).toBe(employeeId);

    // ON DELETE SET NULL: if the active row goes away (DBA-only), the
    // history row keeps existing with employee_id = NULL.
    await client.query("DELETE FROM op_employees WHERE id = $1", [employeeId]);
    const afterDel = await client.query(
      "SELECT employee_id FROM op_employees_history WHERE full_name = 'TEST_linked_active'"
    );
    expect(afterDel.rows[0].employee_id).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Test 3: after is_active=false, a NEW row with the same full_name is OK
  // (re-hire scenario — partial unique index permits this)
  // ────────────────────────────────────────────────────────────────────────
  it("allows re-hire after soft-delete (partial unique index)", async () => {
    // First hire
    const first = await client.query(`
      INSERT INTO op_employees (full_name, role, is_active)
      VALUES ('TEST_rehire_case', 'Driver', TRUE)
      RETURNING id;
    `);
    expect(first.rows[0].id).toBeDefined();

    // Soft-delete
    await client.query(
      "UPDATE op_employees SET is_active = FALSE WHERE id = $1",
      [first.rows[0].id]
    );

    // Re-hire: a new active row with the same full_name should succeed
    const second = await client.query(`
      INSERT INTO op_employees (full_name, role, is_active)
      VALUES ('TEST_rehire_case', 'Driver', TRUE)
      RETURNING id;
    `);
    expect(second.rows[0].id).toBeDefined();
    expect(second.rows[0].id).not.toBe(first.rows[0].id);

    // Sanity: two rows total with this name, exactly one is_active.
    const counts = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE TRUE)::int AS total,
        COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_count
      FROM op_employees WHERE full_name = 'TEST_rehire_case';
    `);
    expect(counts.rows[0].total).toBe(2);
    expect(counts.rows[0].active_count).toBe(1);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Test 4: two simultaneously ACTIVE rows with the same full_name are blocked
  // ────────────────────────────────────────────────────────────────────────
  it("blocks two active rows with the same full_name", async () => {
    await client.query(`
      INSERT INTO op_employees (full_name, role, is_active)
      VALUES ('TEST_dup_active', 'PM', TRUE);
    `);
    await expect(
      client.query(`
        INSERT INTO op_employees (full_name, role, is_active)
        VALUES ('TEST_dup_active', 'PM', TRUE);
      `)
    ).rejects.toThrow(/op_employees_active_full_name_uidx|duplicate key/i);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Test 5: full lifecycle - active -> history with FK -> soft-delete -> read filters
  // ────────────────────────────────────────────────────────────────────────
  it("full lifecycle: active → history(FK) → soft-delete → active filter excludes", async () => {
    // 1. Insert active employee
    const insert = await client.query(`
      INSERT INTO op_employees (full_name, role, is_active)
      VALUES ('TEST_lifecycle', 'QS', TRUE)
      RETURNING id;
    `);
    const empId = insert.rows[0].id;

    // 2. Insert history row linked back via employee_id
    await client.query(
      `INSERT INTO op_employees_history
         (full_name, status, started_at, ended_at, reason, employee_id)
       VALUES ($1, 'resigned', '2026-01-01', '2026-05-13', 'Test scenario', $2);`,
      ["TEST_lifecycle", empId]
    );

    // 3. Flip is_active to false (the soft-delete the workflow mandates)
    await client.query(
      "UPDATE op_employees SET is_active = FALSE WHERE id = $1",
      [empId]
    );

    // 4. Verify the active filter no longer returns this person
    const activeRows = await client.query(
      "SELECT id FROM op_employees WHERE full_name = 'TEST_lifecycle' AND is_active = TRUE"
    );
    expect(activeRows.rowCount).toBe(0);

    // 5. Verify the history row still has the FK link intact
    const hist = await client.query(
      "SELECT employee_id FROM op_employees_history WHERE full_name = 'TEST_lifecycle'"
    );
    expect(hist.rows[0].employee_id).toBe(empId);

    // 6. The soft-deleted row is still there (no DELETE happened)
    const allRows = await client.query(
      "SELECT is_active FROM op_employees WHERE id = $1",
      [empId]
    );
    expect(allRows.rows[0].is_active).toBe(false);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Bonus: migration idempotency for the seed migrations (003, 004, 005).
  // 002 is excluded because it includes CREATE POLICY statements which
  // Postgres does not allow IF NOT EXISTS on; in Supabase 002 is applied
  // exactly once on initial setup. The seed migrations 003+004+005 are the
  // ones the user explicitly required to be re-runnable.
  // ────────────────────────────────────────────────────────────────────────
  it("seed migrations 003+004+005 are idempotent (re-runnable)", async () => {
    await resetClient(client);

    const before = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM op_employees)            AS employees,
        (SELECT COUNT(*)::int FROM op_employees_history)    AS history,
        (SELECT COUNT(*)::int FROM op_departments)          AS departments,
        (SELECT COUNT(*)::int FROM op_projects)             AS projects;
    `);

    const fs = require("fs");
    const path = require("path");
    const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");
    for (const file of [
      "003_operations_seed_real_data.sql",
      "004_operations_employees_history.sql",
      "005_operations_employee_lifecycle.sql",
    ]) {
      await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }

    const after = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM op_employees)            AS employees,
        (SELECT COUNT(*)::int FROM op_employees_history)    AS history,
        (SELECT COUNT(*)::int FROM op_departments)          AS departments,
        (SELECT COUNT(*)::int FROM op_projects)             AS projects;
    `);
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(after.rows[0].employees).toBe(27);
    expect(after.rows[0].history).toBe(15);
  }, 60_000);
});
