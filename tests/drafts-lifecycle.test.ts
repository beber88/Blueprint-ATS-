import { Client } from "pg";
import fs from "fs";
import path from "path";
import { freshClient, resetClient } from "./helpers/db";

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";
const d = RUN_DB_TESTS ? describe : describe.skip;

d("op_report_drafts lifecycle (real Postgres)", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query("DELETE FROM op_report_drafts WHERE source_text LIKE 'TEST_%'");
    await client.query("DELETE FROM op_reports WHERE raw_text LIKE 'TEST_%'");
  });

  // ────────────────────────────────────────────────────────────────────────
  // Insert draft → update warnings → promote to op_reports via save flow.
  // Mirrors what /api/operations/intake/extract → PATCH → /save do.
  // ────────────────────────────────────────────────────────────────────────
  it("draft created → updated → saved produces an op_reports row + FK link", async () => {
    const aiOutput = {
      report_date: "2026-05-12",
      items: [{ issue: "test issue", category: "project" }],
    };

    // 1. Create the draft.
    const { rows: dRows } = await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, warnings_json, source_kind, status)
       VALUES ('TEST_lifecycle_text', $1::jsonb, '[]'::jsonb, 'manual', 'draft')
       RETURNING id, status;`,
      [JSON.stringify(aiOutput)]
    );
    const draftId = dRows[0].id;
    expect(dRows[0].status).toBe("draft");

    // 2. PATCH — simulate adding a warning.
    await client.query(
      `UPDATE op_report_drafts
       SET warnings_json = $1::jsonb, updated_at = NOW()
       WHERE id = $2;`,
      [
        JSON.stringify([
          { code: "MISSING_PROJECT", severity: "high", field: "project" },
        ]),
        draftId,
      ]
    );

    // 3. Save — create op_reports row + link both directions.
    const { rows: rRows } = await client.query(
      `INSERT INTO op_reports
         (source_type, raw_text, report_date, processing_status,
          flagged_for_review, draft_source_id)
       VALUES ('text', 'TEST_lifecycle_text', '2026-05-12', 'completed',
               FALSE, $1)
       RETURNING id, draft_source_id, flagged_for_review;`,
      [draftId]
    );
    const reportId = rRows[0].id;
    expect(rRows[0].draft_source_id).toBe(draftId);
    expect(rRows[0].flagged_for_review).toBe(false);

    await client.query(
      `UPDATE op_report_drafts
       SET status = 'saved', saved_report_id = $1, updated_at = NOW()
       WHERE id = $2;`,
      [reportId, draftId]
    );

    // 4. Verify state.
    const { rows: final } = await client.query(
      `SELECT status, saved_report_id FROM op_report_drafts WHERE id = $1`,
      [draftId]
    );
    expect(final[0].status).toBe("saved");
    expect(final[0].saved_report_id).toBe(reportId);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Save-with-flag path lights up op_reports.flagged_for_review.
  // ────────────────────────────────────────────────────────────────────────
  it("Save & Flag for Review sets op_reports.flagged_for_review = true", async () => {
    const { rows: dRows } = await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST_flag_text', '{}'::jsonb, 'manual', 'draft')
       RETURNING id;`
    );
    const draftId = dRows[0].id;

    const { rows: rRows } = await client.query(
      `INSERT INTO op_reports
         (source_type, raw_text, report_date, processing_status,
          flagged_for_review, draft_source_id)
       VALUES ('text', 'TEST_flag_text', '2026-05-12', 'completed',
               TRUE, $1)
       RETURNING id, flagged_for_review;`,
      [draftId]
    );
    expect(rRows[0].flagged_for_review).toBe(true);

    const { rows: idx } = await client.query(
      `SELECT id FROM op_reports
       WHERE flagged_for_review = TRUE AND id = $1`,
      [rRows[0].id]
    );
    expect(idx.length).toBe(1);
  });

  // ────────────────────────────────────────────────────────────────────────
  // FK draft_source_id is ON DELETE SET NULL — deleting a draft doesn't
  // delete the report.
  // ────────────────────────────────────────────────────────────────────────
  it("deleting a draft sets the linked op_reports.draft_source_id to NULL", async () => {
    const { rows: dRows } = await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST_setnull_text', '{}'::jsonb, 'manual', 'saved')
       RETURNING id;`
    );
    const draftId = dRows[0].id;
    const { rows: rRows } = await client.query(
      `INSERT INTO op_reports
         (source_type, raw_text, report_date, processing_status, draft_source_id)
       VALUES ('text', 'TEST_setnull_text', '2026-05-12', 'completed', $1)
       RETURNING id;`,
      [draftId]
    );
    const reportId = rRows[0].id;

    await client.query("DELETE FROM op_report_drafts WHERE id = $1", [draftId]);

    const { rows: after } = await client.query(
      "SELECT draft_source_id FROM op_reports WHERE id = $1",
      [reportId]
    );
    expect(after[0].draft_source_id).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // CHECK constraint blocks unknown status values.
  // ────────────────────────────────────────────────────────────────────────
  it("CHECK constraint rejects an unknown draft status", async () => {
    await expect(
      client.query(
        `INSERT INTO op_report_drafts
           (source_text, ai_output_json, source_kind, status)
         VALUES ('TEST_bad_status', '{}'::jsonb, 'manual', 'bogus');`
      )
    ).rejects.toThrow(/check constraint/i);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Idempotency of migration 007.
  // ────────────────────────────────────────────────────────────────────────
  it("migration 007 is idempotent (re-runnable)", async () => {
    await resetClient(client);

    // Insert before re-applying.
    await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST_idempo_007', '{}'::jsonb, 'manual', 'draft');`
    );
    const before = await client.query(
      "SELECT COUNT(*)::int AS c FROM op_report_drafts WHERE source_text = 'TEST_idempo_007'"
    );
    expect(before.rows[0].c).toBe(1);

    const sql = fs.readFileSync(
      path.join(__dirname, "..", "supabase", "migrations", "007_operations_drafts.sql"),
      "utf8"
    );
    await client.query(sql);
    await client.query(sql); // second re-run

    const after = await client.query(
      "SELECT COUNT(*)::int AS c FROM op_report_drafts WHERE source_text = 'TEST_idempo_007'"
    );
    expect(after.rows[0].c).toBe(1);

    // Required columns + constraints survived.
    const { rows: cols } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'op_reports'
         AND column_name IN ('flagged_for_review', 'draft_source_id');`
    );
    expect(cols.length).toBe(2);

    const { rows: jobs } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'op_bulk_import_jobs' AND column_name = 'auto_promote';`
    );
    expect(jobs.length).toBe(1);
  }, 60_000);
});
