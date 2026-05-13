import { Client } from "pg";
import { freshClient } from "./helpers/db";

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";
const d = RUN_DB_TESTS ? describe : describe.skip;

// These tests exercise the SCHEMA contract between op_bulk_import_items
// and op_report_drafts (the FK + CASCADE) and the auto-promote decision
// rule. They do NOT invoke the live HTTP route handler — that requires
// Claude + Next runtime — so the worker behavior is reproduced in SQL
// equivalent to what the route does.

d("bulk-import drafts integration (real Postgres)", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query("DELETE FROM op_bulk_import_jobs WHERE source_text_hash LIKE 'TEST_%'");
    await client.query("DELETE FROM op_report_drafts WHERE source_text LIKE 'TEST_%'");
  });

  // ────────────────────────────────────────────────────────────────────────
  // CASCADE: deleting a bulk item cascades to its draft (when the FK
  // is set), but does NOT delete the op_reports row that the draft
  // promoted to (draft_source_id is ON DELETE SET NULL).
  // ────────────────────────────────────────────────────────────────────────
  it("deleting a bulk_import_item cascades to its draft but not to op_reports", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash, auto_promote)
       VALUES (1, 'done', 'TEST_cascade_hash', FALSE) RETURNING id;`
    );
    const jobId = jobRows[0].id;

    const { rows: itemRows } = await client.query(
      `INSERT INTO op_bulk_import_items (job_id, report_index, status)
       VALUES ($1, 0, 'done') RETURNING id;`,
      [jobId]
    );
    const itemId = itemRows[0].id;

    const { rows: draftRows } = await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, source_kind, status, bulk_import_item_id)
       VALUES ('TEST_cascade_text', '{}'::jsonb, 'bulk', 'draft', $1)
       RETURNING id;`,
      [itemId]
    );
    const draftId = draftRows[0].id;

    // Promote-by-hand: insert an op_reports row linked back to the draft.
    const { rows: reportRows } = await client.query(
      `INSERT INTO op_reports
         (source_type, raw_text, report_date, processing_status, draft_source_id)
       VALUES ('text', 'TEST_cascade_text', '2026-05-12', 'completed', $1)
       RETURNING id;`,
      [draftId]
    );
    const reportId = reportRows[0].id;

    await client.query(
      `UPDATE op_report_drafts SET status='saved', saved_report_id=$1 WHERE id=$2`,
      [reportId, draftId]
    );

    // Now delete the bulk item.
    await client.query("DELETE FROM op_bulk_import_items WHERE id=$1", [itemId]);

    // Draft is gone (CASCADE).
    const { rows: draftAfter } = await client.query(
      "SELECT id FROM op_report_drafts WHERE id=$1",
      [draftId]
    );
    expect(draftAfter.length).toBe(0);

    // Report survives, but draft_source_id is now NULL (SET NULL).
    const { rows: reportAfter } = await client.query(
      "SELECT id, draft_source_id FROM op_reports WHERE id=$1",
      [reportId]
    );
    expect(reportAfter.length).toBe(1);
    expect(reportAfter[0].draft_source_id).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // auto_promote=true: drafts with zero high-severity warnings reach
  // status='saved' via the worker; drafts with high warnings stop at
  // 'flagged'.
  // Models the worker decision: warnings.some(w => w.severity === 'high').
  // ────────────────────────────────────────────────────────────────────────
  it("auto_promote rule: zero-high → saved; has-high → flagged", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash, auto_promote)
       VALUES (3, 'running', 'TEST_autopromote_hash', TRUE) RETURNING id;`
    );
    const jobId = jobRows[0].id;

    // 3 items: 2 clean, 1 with a high-severity warning
    const { rows: itemRows } = await client.query(
      `INSERT INTO op_bulk_import_items (job_id, report_index, status)
       VALUES ($1, 0, 'processing'),
              ($1, 1, 'processing'),
              ($1, 2, 'processing')
       RETURNING id, report_index;`,
      [jobId]
    );

    const drafts = [];
    for (let i = 0; i < 3; i++) {
      const warnings = i === 2
        ? [{ code: "MISSING_DATE", severity: "high", field: "report_date" }]
        : [];
      const { rows } = await client.query(
        `INSERT INTO op_report_drafts
           (source_text, ai_output_json, warnings_json, source_kind, status, bulk_import_item_id)
         VALUES ($1, '{"report_date":"2026-05-12"}'::jsonb, $2::jsonb, 'bulk', 'draft', $3)
         RETURNING id;`,
        [`TEST_autopromote_text_${i}`, JSON.stringify(warnings), itemRows[i].id]
      );
      drafts.push({ id: rows[0].id, hasHigh: i === 2 });
    }

    // Worker decision per draft.
    for (const d of drafts) {
      if (!d.hasHigh) {
        // Promote: create op_reports + flip draft to 'saved'.
        const { rows: rRows } = await client.query(
          `INSERT INTO op_reports
             (source_type, raw_text, report_date, processing_status, draft_source_id)
           VALUES ('text', 'TEST_autopromote', '2026-05-12', 'completed', $1)
           RETURNING id;`,
          [d.id]
        );
        await client.query(
          `UPDATE op_report_drafts
           SET status='saved', saved_report_id=$1 WHERE id=$2`,
          [rRows[0].id, d.id]
        );
      } else {
        // Flag for human review.
        await client.query(
          `UPDATE op_report_drafts SET status='flagged' WHERE id=$1`,
          [d.id]
        );
      }
    }

    const { rows: counts } = await client.query(
      `SELECT status, COUNT(*)::int AS c FROM op_report_drafts
       WHERE source_text LIKE 'TEST_autopromote_text_%'
       GROUP BY status ORDER BY status`
    );
    const byStatus = Object.fromEntries(counts.map((r) => [r.status, r.c]));
    expect(byStatus).toEqual({ flagged: 1, saved: 2 });

    // Reports were created only for the saved drafts.
    const { rows: reports } = await client.query(
      `SELECT COUNT(*)::int AS c FROM op_reports WHERE raw_text = 'TEST_autopromote'`
    );
    expect(reports[0].c).toBe(2);
  });

  // ────────────────────────────────────────────────────────────────────────
  // auto_promote=false: drafts stay as 'draft' regardless of warnings.
  // The operator must Save/Discard via the Preview UI.
  // ────────────────────────────────────────────────────────────────────────
  it("auto_promote=false: drafts stay as 'draft' until human action", async () => {
    const { rows: jobRows } = await client.query(
      `INSERT INTO op_bulk_import_jobs (total_reports, status, source_text_hash, auto_promote)
       VALUES (3, 'running', 'TEST_manual_hash', FALSE) RETURNING id;`
    );
    const jobId = jobRows[0].id;

    const { rows: itemRows } = await client.query(
      `INSERT INTO op_bulk_import_items (job_id, report_index, status)
       VALUES ($1, 0, 'processing'),
              ($1, 1, 'processing'),
              ($1, 2, 'processing')
       RETURNING id, report_index;`,
      [jobId]
    );

    for (let i = 0; i < 3; i++) {
      await client.query(
        `INSERT INTO op_report_drafts
           (source_text, ai_output_json, source_kind, status, bulk_import_item_id)
         VALUES ($1, '{}'::jsonb, 'bulk', 'draft', $2);`,
        [`TEST_manual_text_${i}`, itemRows[i].id]
      );
    }

    const { rows: counts } = await client.query(
      `SELECT status, COUNT(*)::int AS c FROM op_report_drafts
       WHERE source_text LIKE 'TEST_manual_text_%' GROUP BY status`
    );
    expect(counts).toEqual([{ status: "draft", c: 3 }]);

    // No reports yet.
    const { rows: reports } = await client.query(
      `SELECT COUNT(*)::int AS c FROM op_reports WHERE raw_text LIKE 'TEST_manual_text_%'`
    );
    expect(reports[0].c).toBe(0);
  });
});
