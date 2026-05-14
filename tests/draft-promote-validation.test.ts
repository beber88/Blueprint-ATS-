import { Client } from "pg";
import { freshClient } from "./helpers/db";
import { promoteDraft } from "@/lib/operations/draft-promote";
import type { SupabaseClient } from "@supabase/supabase-js";

const RUN_DB_TESTS = process.env.SKIP_DB_TESTS !== "true";
const d = RUN_DB_TESTS ? describe : describe.skip;

// Build a minimal SupabaseClient shim that targets our raw pg test client.
// This lets us exercise promoteDraft against real Postgres without spinning
// up a Supabase instance. We only stub the methods promoteDraft uses.
function shim(pg: Client): SupabaseClient {
  function from(table: string) {
    return {
      insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(row) ? row : [row];
        const cols = Object.keys(rows[0]);
        const values = rows
          .map(
            (r, i) =>
              "(" +
              cols
                .map((_, j) => `$${i * cols.length + j + 1}`)
                .join(",") +
              ")"
          )
          .join(",");
        const params = rows.flatMap((r) =>
          cols.map((c) => {
            const v = r[c];
            if (v && typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
            return v;
          })
        );
        const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES ${values}`;
        return {
          select: () => ({
            single: async () => {
              try {
                const res = await pg.query(`${sql} RETURNING *`, params);
                return { data: res.rows[0], error: null };
              } catch (e) {
                return { data: null, error: { message: (e as Error).message } };
              }
            },
          }),
          then: async (resolve: (v: { error: { message: string } | null }) => void) => {
            try {
              await pg.query(sql, params);
              resolve({ error: null });
            } catch (e) {
              resolve({ error: { message: (e as Error).message } });
            }
          },
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
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
          single: async () => ({ data: null }),
        }),
      }),
      delete: () => ({
        eq: async (_col: string, _val: unknown) => ({ error: null }),
      }),
    } as unknown as ReturnType<SupabaseClient["from"]>;
  }
  return { from } as unknown as SupabaseClient;
}

d("promoteDraft — defensive normalization of constrained fields", () => {
  let client: Client;

  beforeAll(async () => {
    client = await freshClient();
  }, 60_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query("DELETE FROM op_report_drafts WHERE source_text LIKE 'TEST_promote_%'");
    await client.query("DELETE FROM op_reports WHERE raw_text LIKE 'TEST_promote_%'");
  });

  // ────────────────────────────────────────────────────────────────────
  // The schema's CHECK constraints reject items.status='closed' (only
  // open|in_progress|blocked|resolved are allowed). extract-report.ts
  // already filters AI output, but a PATCH to a draft could smuggle
  // any value through. promoteDraft now normalizes to defaults.
  // ────────────────────────────────────────────────────────────────────
  it("rejects/normalizes invalid status / priority / category values", async () => {
    const { rows: dRows } = await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST_promote_invalid', $1::jsonb, 'manual', 'draft')
       RETURNING *;`,
      [
        JSON.stringify({
          report_date: "2026-05-12",
          items: [
            { issue: "completed task", status: "closed", priority: "critical", category: "weather" },
            { issue: "valid task", status: "open", priority: "high", category: "hr" },
          ],
        }),
      ]
    );
    const draft = dRows[0];

    const supabase = shim(client);
    const result = await promoteDraft(supabase, draft, {});

    expect(result.itemsCount).toBe(2);

    // First item: all 3 fields were invalid → normalized to defaults.
    const { rows: items } = await client.query(
      `SELECT status, priority, category FROM op_report_items
       WHERE report_id=$1 ORDER BY issue`,
      [result.reportId]
    );
    expect(items).toHaveLength(2);
    // "completed task" first alphabetically
    expect(items[0]).toMatchObject({ status: "open", priority: "medium", category: "other" });
    // "valid task" — kept as-is
    expect(items[1]).toMatchObject({ status: "open", priority: "high", category: "hr" });
  });

  it("preserves all four valid statuses (open, in_progress, blocked, resolved)", async () => {
    const { rows: dRows } = await client.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, source_kind, status)
       VALUES ('TEST_promote_valid', $1::jsonb, 'manual', 'draft')
       RETURNING *;`,
      [
        JSON.stringify({
          report_date: "2026-05-12",
          items: [
            { issue: "a-open", status: "open" },
            { issue: "b-in_progress", status: "in_progress" },
            { issue: "c-blocked", status: "blocked" },
            { issue: "d-resolved", status: "resolved" },
          ],
        }),
      ]
    );
    const supabase = shim(client);
    const result = await promoteDraft(supabase, dRows[0], {});
    const { rows: items } = await client.query(
      `SELECT issue, status FROM op_report_items WHERE report_id=$1 ORDER BY issue`,
      [result.reportId]
    );
    expect(items.map((r) => r.status)).toEqual(["open", "in_progress", "blocked", "resolved"]);
  });
});
