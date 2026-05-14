import { Client } from "pg";
import { freshClient } from "./helpers/db";

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";
const d = RUN_DB_TESTS ? describe : describe.skip;

// Real-Postgres lifecycle of the Contracts module drafts pipeline,
// mirroring tests/drafts-lifecycle.test.ts for the operations module.
//
// Validates the migration-008 schema contract:
//   1. Draft insert → ct_contract_drafts row.
//   2. PATCH updates ai_output_json and warnings_json.
//   3. Save flow inserts ct_contracts + flips draft to 'saved'.
//   4. saved_contract_id FK links back; draft_source_id on the contract
//      points the other way.
//   5. CASCADE on draft delete preserves the saved contract (FK is SET NULL).
//   6. ct_alerts partial-unique blocks duplicate unresolved alerts.

d("ct_contract_drafts lifecycle (real Postgres)", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query(
      "DELETE FROM ct_contract_drafts WHERE source_text LIKE 'TEST_%'"
    );
    await client.query(
      "DELETE FROM ct_contracts WHERE counterparty_name LIKE 'TEST_%'"
    );
  });

  it("draft created → updated → saved produces a ct_contracts row + FK link", async () => {
    const aiOutput = {
      category: "subcontractor",
      counterparty_name: "TEST_Renz",
      title: "Test Concrete Works",
      expiration_date: "2026-12-31",
    };

    // Step 1 — insert draft
    const draftInsert = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, warnings_json, source_kind, status)
       VALUES ($1, $2::jsonb, $3::jsonb, 'manual', 'draft') RETURNING id`,
      ["TEST_source_text 1", JSON.stringify(aiOutput), "[]"]
    );
    const draftId = draftInsert.rows[0].id as string;
    expect(draftId).toBeTruthy();

    // Step 2 — PATCH (simulate Preview UI inline-edit)
    await client.query(
      `UPDATE ct_contract_drafts SET ai_output_json = $1::jsonb, warnings_json = $2::jsonb WHERE id = $3`,
      [
        JSON.stringify({ ...aiOutput, monetary_value: 100000, currency: "PHP" }),
        JSON.stringify([
          { code: "PROJECT_NOT_FOUND", severity: "medium", field: "project_hint" },
        ]),
        draftId,
      ]
    );

    // Step 3 — save: insert ct_contracts + flip draft
    const contractInsert = await client.query(
      `INSERT INTO ct_contracts
         (category, counterparty_name, title, monetary_value, currency,
          expiration_date, status, draft_source_id)
       VALUES ('subcontractor', 'TEST_Renz', 'Test Concrete Works',
               100000, 'PHP', '2026-12-31', 'active', $1)
       RETURNING id`,
      [draftId]
    );
    const contractId = contractInsert.rows[0].id as string;

    await client.query(
      `UPDATE ct_contract_drafts SET status='saved', saved_contract_id=$1 WHERE id=$2`,
      [contractId, draftId]
    );

    // Step 4 — verify both FKs link
    const draftAfter = await client.query(
      "SELECT status, saved_contract_id FROM ct_contract_drafts WHERE id=$1",
      [draftId]
    );
    expect(draftAfter.rows[0].status).toBe("saved");
    expect(draftAfter.rows[0].saved_contract_id).toBe(contractId);

    const contractAfter = await client.query(
      "SELECT draft_source_id FROM ct_contracts WHERE id=$1",
      [contractId]
    );
    expect(contractAfter.rows[0].draft_source_id).toBe(draftId);
  });

  it("deleting a saved draft sets ct_contracts.draft_source_id to NULL (preserves contract)", async () => {
    const draftRes = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST_source_text 2', '{}'::jsonb, 'manual', 'saved') RETURNING id`
    );
    const draftId = draftRes.rows[0].id as string;

    const contractRes = await client.query(
      `INSERT INTO ct_contracts
         (category, counterparty_name, title, draft_source_id)
       VALUES ('vendor', 'TEST_DraftLink', 'X', $1)
       RETURNING id`,
      [draftId]
    );
    const contractId = contractRes.rows[0].id as string;

    // Delete the draft.
    await client.query("DELETE FROM ct_contract_drafts WHERE id=$1", [draftId]);

    const after = await client.query(
      "SELECT id, draft_source_id FROM ct_contracts WHERE id=$1",
      [contractId]
    );
    expect(after.rows[0].id).toBe(contractId);            // contract survived
    expect(after.rows[0].draft_source_id).toBeNull();     // FK became NULL
  });

  it("deleting a contract CASCADEs to its ct_alerts", async () => {
    const contractRes = await client.query(
      `INSERT INTO ct_contracts (category, counterparty_name, title)
       VALUES ('vendor', 'TEST_CascadeAlert', 'X') RETURNING id`
    );
    const contractId = contractRes.rows[0].id as string;

    await client.query(
      `INSERT INTO ct_alerts (contract_id, type, severity, message)
       VALUES ($1, 'expiring_soon', 'medium', 'TEST alert')`,
      [contractId]
    );

    await client.query("DELETE FROM ct_contracts WHERE id=$1", [contractId]);

    const alertCount = await client.query(
      "SELECT COUNT(*)::int AS n FROM ct_alerts WHERE message='TEST alert'"
    );
    expect(alertCount.rows[0].n).toBe(0);
  });

  it("ct_alerts partial-unique blocks duplicate unresolved alerts of same type", async () => {
    const contractRes = await client.query(
      `INSERT INTO ct_contracts (category, counterparty_name, title, expiration_date, status)
       VALUES ('subcontractor', 'TEST_AlertDup', 'X', '2026-12-31', 'active') RETURNING id`
    );
    const contractId = contractRes.rows[0].id as string;

    await client.query(
      `INSERT INTO ct_alerts (contract_id, type, severity, message)
       VALUES ($1, 'expiring_soon', 'medium', 'first alert')`,
      [contractId]
    );

    // Second insert with same (contract_id, type) and resolved_at IS NULL
    // must violate the partial unique.
    await expect(
      client.query(
        `INSERT INTO ct_alerts (contract_id, type, severity, message)
         VALUES ($1, 'expiring_soon', 'medium', 'duplicate alert')`,
        [contractId]
      )
    ).rejects.toThrow();

    // But after the first one is resolved, a new unresolved alert is OK
    // (the unique is partial, only WHERE resolved_at IS NULL).
    await client.query(
      "UPDATE ct_alerts SET resolved_at = NOW() WHERE contract_id=$1 AND message='first alert'",
      [contractId]
    );
    await client.query(
      `INSERT INTO ct_alerts (contract_id, type, severity, message)
       VALUES ($1, 'expiring_soon', 'medium', 'new alert')`,
      [contractId]
    );

    // Clean up so beforeEach is fast next time.
    await client.query("DELETE FROM ct_contracts WHERE id=$1", [contractId]);
  });

  it("CHECK constraints reject invalid category / status / currency / type", async () => {
    await expect(
      client.query(
        `INSERT INTO ct_contracts (category, counterparty_name, title)
         VALUES ('not_a_category', 'TEST_Bad', 'X')`
      )
    ).rejects.toThrow();

    await expect(
      client.query(
        `INSERT INTO ct_contracts (category, counterparty_name, title, status)
         VALUES ('vendor', 'TEST_Bad', 'X', 'not_a_status')`
      )
    ).rejects.toThrow();

    await expect(
      client.query(
        `INSERT INTO ct_contracts (category, counterparty_name, title, currency)
         VALUES ('vendor', 'TEST_Bad', 'X', 'TOOLONG')`
      )
    ).rejects.toThrow();

    // Need an existing contract to test ct_alerts CHECK
    const c = await client.query(
      `INSERT INTO ct_contracts (category, counterparty_name, title)
       VALUES ('vendor', 'TEST_CheckAlerts', 'X') RETURNING id`
    );
    await expect(
      client.query(
        `INSERT INTO ct_alerts (contract_id, type, severity, message)
         VALUES ($1, 'not_a_type', 'medium', 'X')`,
        [c.rows[0].id]
      )
    ).rejects.toThrow();
    await client.query("DELETE FROM ct_contracts WHERE id=$1", [c.rows[0].id]);
  });
});
