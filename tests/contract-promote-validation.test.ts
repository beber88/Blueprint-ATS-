import { Client } from "pg";
import { freshClient } from "./helpers/db";
import { promoteContract } from "@/lib/contracts/contract-promote";
import type { ContractDraftRow } from "@/lib/contracts/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";
const d = RUN_DB_TESTS ? describe : describe.skip;

// Minimal SupabaseClient shim against the real pg test client. Same
// pattern as tests/draft-promote-validation.test.ts. We only need the
// methods promoteContract actually calls:
//   - from('op_projects').select('id, name').eq('status', 'active')
//     (returns promise resolving to { data: [], error: null })
//   - from('ct_contracts').insert(...).select(...).single()
//   - from('ct_contract_drafts').update(...).eq('id', ...)
function shim(pg: Client): SupabaseClient {
  function from(table: string) {
    // select().eq() — returns awaitable that resolves to { data, error }.
    // We always return empty data for op_projects so resolveProjectId is
    // a no-op; the test cases use project_hint: null anyway.
    const selectChain = (_cols: string) => ({
      eq: (_col: string, _val: unknown) => {
        const promiseLike = {
          then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
            resolve({ data: [], error: null }),
        };
        return Object.assign(promiseLike, {
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        });
      },
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
    });

    return {
      select: selectChain,
      insert: (row: Record<string, unknown>) => {
        const cols = Object.keys(row);
        const placeholders = cols.map((_c, i) => `$${i + 1}`).join(",");
        const values = cols.map((c) => {
          const v = row[c];
          if (v !== null && v !== undefined && typeof v === "object" && !(v instanceof Date)) {
            return JSON.stringify(v);
          }
          return v;
        });
        const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
        return {
          select: (_returningCols?: string) => ({
            single: async () => {
              try {
                const res = await pg.query(`${sql} RETURNING *`, values);
                return { data: res.rows[0], error: null };
              } catch (e) {
                return { data: null, error: { message: (e as Error).message } };
              }
            },
          }),
        };
      },
      update: (patch: Record<string, unknown>) => {
        const cols = Object.keys(patch);
        const setSql = cols.map((c, i) => `${c}=$${i + 1}`).join(",");
        return {
          eq: async (col: string, val: unknown) => {
            const sql = `UPDATE ${table} SET ${setSql} WHERE ${col}=$${cols.length + 1}`;
            await pg.query(sql, [...cols.map((c) => patch[c]), val]);
            return { error: null };
          },
        };
      },
    } as unknown as ReturnType<SupabaseClient["from"]>;
  }
  return { from } as unknown as SupabaseClient;
}

function buildDraft(over: Record<string, unknown> = {}): ContractDraftRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    source_text: "TEST contract text",
    ai_output_json: {
      category: "subcontractor",
      title: "Test Contract",
      counterparty_name: "Test Co",
      counterparty_contact: { name: null, email: null, phone: null },
      project_hint: null, // important: skips the project lookup
      signing_date: "2026-04-02",
      effective_date: "2026-04-05",
      expiration_date: "2026-12-31",
      renewal_date: null,
      is_renewable: false,
      monetary_value: 100,
      currency: "USD",
      summary: "test",
      confidence: 0.9,
      notes: null,
      ...over,
    },
    warnings_json: [],
    status: "draft",
    source_kind: "manual",
    saved_contract_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

d("promoteContract — defensive normalization", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query(
      "DELETE FROM ct_contracts WHERE counterparty_name LIKE 'TEST_%' OR title LIKE 'Test%'"
    );
    await client.query(
      "DELETE FROM ct_contract_drafts WHERE source_text LIKE 'TEST%'"
    );
  });

  it("invalid category in draft is normalized to 'vendor'", async () => {
    // We can't actually pass an invalid category to the schema unless we
    // bypass the CHECK. The promote helper picks a fallback if the AI
    // output contains an invalid value. Insert a draft with category='other'
    // (not in the enum) via the helper's input.
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote bad category', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ category: "other" });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    expect(result.category).toBe("vendor"); // fallback
    expect(result.contractId).toBeTruthy();
  });

  it("invalid currency in draft is normalized to null", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote bad currency', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ currency: "DOLLARS" });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const row = await client.query(
      "SELECT currency FROM ct_contracts WHERE id=$1",
      [result.contractId]
    );
    expect(row.rows[0].currency).toBeNull();
  });

  it("invalid date format in draft is normalized to null (not the bad string)", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote bad date', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ signing_date: "yesterday" });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const row = await client.query(
      "SELECT signing_date FROM ct_contracts WHERE id=$1",
      [result.contractId]
    );
    expect(row.rows[0].signing_date).toBeNull();
  });

  it("empty title is replaced with 'Untitled contract'", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote empty title', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ title: "   " });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const row = await client.query(
      "SELECT title FROM ct_contracts WHERE id=$1",
      [result.contractId]
    );
    expect(row.rows[0].title).toBe("Untitled contract");
  });

  it("draft is flipped to 'saved' and saved_contract_id is populated", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote save flip', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft();
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const after = await client.query(
      "SELECT status, saved_contract_id FROM ct_contract_drafts WHERE id=$1",
      [draftId]
    );
    expect(after.rows[0].status).toBe("saved");
    expect(after.rows[0].saved_contract_id).toBe(result.contractId);
  });

  it("flagForReview flips draft.status to 'flagged' instead of 'saved'", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote flag', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft();
    draft.id = draftId;

    await promoteContract(shim(client), draft, { flagForReview: true });
    const after = await client.query(
      "SELECT status FROM ct_contract_drafts WHERE id=$1",
      [draftId]
    );
    expect(after.rows[0].status).toBe("flagged");
  });

  it("project_hint set with empty roster: resolveProjectId returns null gracefully", async () => {
    // Exercises the resolveProjectId path where hint is provided but the
    // op_projects haystack is empty (the shim always returns []).
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote project hint empty roster', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ project_hint: "Some Tower" });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const row = await client.query(
      "SELECT project_id FROM ct_contracts WHERE id=$1",
      [result.contractId]
    );
    expect(row.rows[0].project_id).toBeNull();
  });

  it("project_hint as empty string: resolveProjectId short-circuits to null", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote project hint empty string', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ project_hint: "   " });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const row = await client.query(
      "SELECT project_id FROM ct_contracts WHERE id=$1",
      [result.contractId]
    );
    expect(row.rows[0].project_id).toBeNull();
  });

  it("counterparty_name empty/null is normalized to 'Unknown'", async () => {
    const draftIns = await client.query(
      `INSERT INTO ct_contract_drafts (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST promote empty counterparty', '{}'::jsonb, 'manual', 'draft') RETURNING id`
    );
    const draftId = draftIns.rows[0].id as string;
    const draft = buildDraft({ counterparty_name: "" });
    draft.id = draftId;

    const result = await promoteContract(shim(client), draft, {});
    const row = await client.query(
      "SELECT counterparty_name FROM ct_contracts WHERE id=$1",
      [result.contractId]
    );
    expect(row.rows[0].counterparty_name).toBe("Unknown");
  });
});
