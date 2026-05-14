import { Client } from "pg";
import fs from "fs";
import path from "path";
import { freshClient, resetClient } from "./helpers/db";

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";
const d = RUN_DB_TESTS ? describe : describe.skip;

d("op_bulk_import_jobs + op_bulk_import_items (real Postgres)", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query("DELETE FROM op_bulk_import_jobs WHERE source_text_hash LIKE 'TEST_%'");
  });

  // ────────────────────────────────────────────────────────────────────────
  // CASCADE: deleting a job deletes its items.
  // ────────────────────────────────────────────────────────────────────────
  it("ON DELETE CASCADE removes items when their job is deleted", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash)
       VALUES (5, 'queued', 'TEST_cascade_hash') RETURNING id;`
    );
    const jobId = jobRows[0].id;
    await client.query(
      `INSERT INTO op_bulk_import_items (job_id, report_index, status)
       VALUES ($1, 0, 'pending'), ($1, 1, 'pending'), ($1, 2, 'pending'),
              ($1, 3, 'pending'), ($1, 4, 'pending');`,
      [jobId]
    );
    const before = await client.query(
      "SELECT COUNT(*)::int AS c FROM op_bulk_import_items WHERE job_id = $1",
      [jobId]
    );
    expect(before.rows[0].c).toBe(5);

    await client.query("DELETE FROM op_bulk_import_jobs WHERE id = $1", [jobId]);

    const after = await client.query(
      "SELECT COUNT(*)::int AS c FROM op_bulk_import_items WHERE job_id = $1",
      [jobId]
    );
    expect(after.rows[0].c).toBe(0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Cancel propagation: status=cancelled affects pending items, NOT processing.
  // ────────────────────────────────────────────────────────────────────────
  it("cancelling a job flips pending items only; processing items keep status", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash)
       VALUES (3, 'running', 'TEST_cancel_hash') RETURNING id;`
    );
    const jobId = jobRows[0].id;
    await client.query(
      `INSERT INTO op_bulk_import_items (job_id, report_index, status)
       VALUES ($1, 0, 'pending'), ($1, 1, 'processing'), ($1, 2, 'done');`,
      [jobId]
    );

    // Simulate the cancel endpoint's UPDATEs.
    await client.query(
      "UPDATE op_bulk_import_jobs SET status='cancelled', cancelled_at=NOW() WHERE id=$1",
      [jobId]
    );
    await client.query(
      "UPDATE op_bulk_import_items SET status='cancelled' WHERE job_id=$1 AND status='pending'",
      [jobId]
    );

    const counts = await client.query(
      `SELECT status, COUNT(*)::int AS c FROM op_bulk_import_items
       WHERE job_id=$1 GROUP BY status ORDER BY status;`,
      [jobId]
    );
    const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.c]));
    expect(byStatus).toEqual({
      cancelled: 1,
      processing: 1,
      done: 1,
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // CHECK constraints: an unknown status is rejected.
  // ────────────────────────────────────────────────────────────────────────
  it("rejects an unknown item status via the CHECK constraint", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash)
       VALUES (1, 'queued', 'TEST_check_hash') RETURNING id;`
    );
    const jobId = jobRows[0].id;
    await expect(
      client.query(
        `INSERT INTO op_bulk_import_items (job_id, report_index, status)
         VALUES ($1, 0, 'BOGUS')`,
        [jobId]
      )
    ).rejects.toThrow(/check constraint/i);
  });

  // ────────────────────────────────────────────────────────────────────────
  // UNIQUE (job_id, report_index): can't double-insert the same chunk.
  // ────────────────────────────────────────────────────────────────────────
  it("UNIQUE(job_id, report_index) prevents duplicate chunk inserts", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash)
       VALUES (1, 'queued', 'TEST_dup_idx_hash') RETURNING id;`
    );
    const jobId = jobRows[0].id;
    await client.query(
      `INSERT INTO op_bulk_import_items (job_id, report_index, status)
       VALUES ($1, 0, 'pending');`,
      [jobId]
    );
    await expect(
      client.query(
        `INSERT INTO op_bulk_import_items (job_id, report_index, status)
         VALUES ($1, 0, 'pending');`,
        [jobId]
      )
    ).rejects.toThrow(/duplicate key|op_bulk_import_items_job_report_index_key/i);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Dedup hash query — same text produces same hash; jobs with the same hash
  // are findable for the dedup guard.
  // ────────────────────────────────────────────────────────────────────────
  it("dedup hash lookup returns prior done jobs within the window", async () => {
    const HASH = "TEST_dedup_same_hash";
    await client.query(
      `INSERT INTO op_bulk_import_jobs
         (total_reports, status, source_text_hash, created_at)
       VALUES (10, 'done', $1, NOW() - INTERVAL '3 hours')`,
      [HASH]
    );
    // Earlier failed job with same hash should NOT match.
    await client.query(
      `INSERT INTO op_bulk_import_jobs
         (total_reports, status, source_text_hash, created_at)
       VALUES (10, 'failed', $1, NOW() - INTERVAL '5 hours')`,
      [HASH]
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { rows } = await client.query(
      `SELECT id, status, created_at FROM op_bulk_import_jobs
       WHERE source_text_hash = $1 AND status = 'done' AND created_at >= $2
       ORDER BY created_at DESC LIMIT 1;`,
      [HASH, since]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("done");
  });

  // ────────────────────────────────────────────────────────────────────────
  // Idempotency: migration 006 is re-runnable.
  // ────────────────────────────────────────────────────────────────────────
  it("migration 006 is idempotent (re-runnable)", async () => {
    await resetClient(client);
    // Insert a job before re-applying 006 to ensure data isn't disturbed.
    await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash)
       VALUES (3, 'done', 'TEST_idempo_006_hash');`
    );
    const before = await client.query(
      "SELECT COUNT(*)::int AS c FROM op_bulk_import_jobs WHERE source_text_hash = 'TEST_idempo_006_hash'"
    );
    expect(before.rows[0].c).toBe(1);

    const sql = fs.readFileSync(
      path.join(__dirname, "..", "supabase", "migrations", "006_operations_bulk_import_jobs.sql"),
      "utf8"
    );
    await client.query(sql);
    await client.query(sql); // run a second time to confirm true idempotency

    const after = await client.query(
      "SELECT COUNT(*)::int AS c FROM op_bulk_import_jobs WHERE source_text_hash = 'TEST_idempo_006_hash'"
    );
    expect(after.rows[0].c).toBe(1);

    // Schema still has the partial unique index, constraints, RLS.
    const { rows: idx } = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'op_bulk_import_items'
         AND indexname IN (
           'idx_op_bulk_import_items_job_status',
           'op_bulk_import_items_job_report_index_key'
         );`
    );
    expect(idx.length).toBe(2);
  }, 60_000);
});
