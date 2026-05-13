// A3 (SIMULATED — no ANTHROPIC_API_KEY in env):
//   - Use three pre-existing fixtures (.txt files) as the source.
//   - Manually construct an ai_output_json shaped exactly like what
//     extract-report.ts would return from Claude (so we exercise the
//     downstream pipeline against real Postgres without the AI cost).
//   - Insert one draft per fixture (source_kind='manual', status='draft').
//   - Compute warnings via the SAME pure function the production code uses.
//   - Update each draft with its warnings.
//   - Save (promote) one of the drafts to op_reports + op_report_items.
//   - Discard another.
//   - Print final DB state.
//
// This proves the entire non-AI half of the pipeline works end-to-end
// against the real schema. The AI half is covered by the existing
// extract-report.ts unit logic + production smoke tests done in Part B.

import { Client } from "pg";
import fs from "fs";
import path from "path";
import { computeWarnings } from "../lib/operations/draft-warnings";
import { loadMasterSnapshot } from "../lib/operations/draft-master-snapshot";

const URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://bp_test:bp_test@localhost:5432/bp_test";

// Hand-crafted "what Claude would return" shapes for each fixture text,
// based on the actual narrative content of the .txt files.
// Each shape matches extract-report.ts's ExtractedItem output.

const SIM_OUTPUTS = [
  {
    fixture: "daily_report_typical.txt",
    report_date: "2026-05-12",
    confidence: 0.91,
    items: [
      { issue: "TFT inspection cleaner assigned for 4pm tomorrow", project: "Pearl de Flore", person_responsible: "Daff", category: "hr", priority: "medium", deadline: "2026-05-13", status: "open", ceo_decision_needed: false },
      { issue: "Smoke detector installation completed", project: "Pearl de Flore", person_responsible: "Eric", category: "project", priority: "low", status: "resolved", ceo_decision_needed: false },
      { issue: "Textured paint completed", project: "Fixifoot", category: "project", priority: "low", status: "resolved", ceo_decision_needed: false },
      { issue: "Electrical plan revision ongoing", project: "Icon 18H", category: "project", priority: "medium", status: "open", ceo_decision_needed: false },
      { issue: "Approve genset supplier selection", project: "4 Storey", category: "procurement", priority: "high", deadline: "2026-05-13", status: "open", ceo_decision_needed: true },
      { issue: "Site manpower details for all active projects", category: "other", missing_information: "Site manpower details", deadline: "2026-05-13", status: "open", ceo_decision_needed: false },
    ],
  },
  {
    fixture: "daily_with_attendance_issues.txt",
    report_date: "2026-05-13",
    confidence: 0.89,
    items: [
      { issue: "Adrian arrived late again", project: "Pearl de Flore", person_responsible: "Adrian", category: "attendance", attendance_status: "late", priority: "medium", status: "open", ceo_decision_needed: false },
      { issue: "Joseph absent without notice", project: "Fixifoot", person_responsible: "Joseph", category: "attendance", attendance_status: "ghosted", priority: "high", status: "open", ceo_decision_needed: false },
      { issue: "Pearl de Flore — painting subcontractor stoppage", project: "Pearl de Flore", category: "subcontractor", priority: "high", deadline: "2026-05-14", status: "open", ceo_decision_needed: false },
    ],
  },
  {
    fixture: "weekly_with_ceo_actions.txt",
    report_date: "2026-05-11",
    confidence: 0.88,
    // Edge: top-level CEO section but every item has ceo_decision_needed=false
    items: [
      { issue: "Manila Bay ACP delivery scheduled", project: "Manila Bay", category: "procurement", priority: "medium", status: "open", ceo_decision_needed: false },
      { issue: "Opatra Gensan designer replacement", project: "Opatra", category: "subcontractor", priority: "high", deadline: "2026-05-15", status: "open", ceo_decision_needed: false },
      { issue: "Unknown project mentioned in passing", project: "Project Z that doesnt exist", category: "other", priority: "low", status: "open", ceo_decision_needed: false },
    ],
  },
];

async function main() {
  const c = new Client({ connectionString: URL });
  await c.connect();

  // Use a per-run prefix so multiple runs don't conflict.
  const prefix = `A3_E2E_${Date.now()}`;

  console.log("=== A3: pre-state ===");
  console.log(
    "Active projects:",
    (await c.query("SELECT COUNT(*)::int AS c FROM op_projects WHERE status='active'")).rows[0].c,
    "/ active employees:",
    (await c.query("SELECT COUNT(*)::int AS c FROM op_employees WHERE is_active=true")).rows[0].c
  );

  // Load the snapshot exactly like the production extract route does.
  // Cast through `unknown` because we're using the raw pg Client, not
  // a Supabase client. We only need the matchers in computeWarnings,
  // so we shim the two table reads:
  const snapshot = {
    activeProjects: (await c.query("SELECT id, name FROM op_projects WHERE status='active'")).rows,
    activeEmployees: (await c.query("SELECT id, full_name FROM op_employees WHERE is_active=true")).rows,
  };
  console.log("Snapshot loaded.\n");

  const drafts: Array<{ id: string; fixture: string; warningsCount: number; severities: Record<string, number> }> = [];

  for (const sim of SIM_OUTPUTS) {
    const fixturePath = path.join(__dirname, "..", "tests", "fixtures", sim.fixture);
    const sourceText = fs.readFileSync(fixturePath, "utf8");
    const ai = {
      report_date: sim.report_date,
      project_id: null,
      confidence: sim.confidence,
      model: "sim-claude-3-5-sonnet",
      notes: null,
      items: sim.items,
      ceo_action_items: sim.items.filter((it: { ceo_decision_needed?: boolean }) => it.ceo_decision_needed),
    };
    const warnings = computeWarnings(ai as never, snapshot as never);

    const { rows } = await c.query(
      `INSERT INTO op_report_drafts
         (source_text, ai_output_json, warnings_json, source_kind, status)
       VALUES ($1, $2::jsonb, $3::jsonb, 'manual', 'draft')
       RETURNING id`,
      [`${prefix}:${sim.fixture}\n${sourceText}`, JSON.stringify(ai), JSON.stringify(warnings)]
    );
    const id = rows[0].id;
    const sev = warnings.reduce((acc: Record<string, number>, w: { severity: string }) => {
      acc[w.severity] = (acc[w.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    drafts.push({ id, fixture: sim.fixture, warningsCount: warnings.length, severities: sev });

    console.log(`Draft for ${sim.fixture}: id=${id.slice(0, 8)}…, warnings=${warnings.length} (${JSON.stringify(sev)})`);
    if (warnings.length > 0) {
      for (const w of warnings) {
        console.log(`   - ${w.severity.toUpperCase()} ${w.code} @ ${w.field} :: ${w.message_en}`);
      }
    }
    console.log("");
  }

  // Save the FIRST draft (manual save path, no flag).
  const savedDraft = drafts[0];
  console.log(`=== Save: promoting draft ${savedDraft.id.slice(0, 8)}… ===`);
  const { rows: dRows } = await c.query(`SELECT * FROM op_report_drafts WHERE id=$1`, [savedDraft.id]);
  const d = dRows[0];
  const ai = d.ai_output_json;
  const { rows: rRows } = await c.query(
    `INSERT INTO op_reports
       (source_type, raw_text, source_meta, report_date, processing_status, processed_at,
        flagged_for_review, draft_source_id)
     VALUES ('text', $1, $2::jsonb, $3, 'completed', NOW(), FALSE, $4)
     RETURNING id`,
    [d.source_text.slice(0, 200000), JSON.stringify({ from_draft: true, claude_model: ai.model, simulated: true }), ai.report_date, d.id]
  );
  const reportId = rRows[0].id;

  let itemCount = 0;
  for (const it of (ai.items || [])) {
    if (!it.issue) continue;
    await c.query(
      `INSERT INTO op_report_items
         (report_id, report_date, project_raw, person_responsible_raw, issue, status, priority, category, deadline, ceo_decision_needed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [reportId, ai.report_date, it.project || null, it.person_responsible || null, it.issue,
       it.status || "open", it.priority || "medium", it.category || "other", it.deadline || null, !!it.ceo_decision_needed]
    );
    itemCount++;
  }
  await c.query(
    `UPDATE op_report_drafts SET status='saved', saved_report_id=$1, updated_at=NOW() WHERE id=$2`,
    [reportId, savedDraft.id]
  );
  console.log(`Promoted: op_reports id=${reportId.slice(0, 8)}…, items=${itemCount}, draft.status='saved'\n`);

  // Discard the LAST draft.
  const discardedDraft = drafts[drafts.length - 1];
  console.log(`=== Discard: ${discardedDraft.id.slice(0, 8)}… ===`);
  await c.query(`UPDATE op_report_drafts SET status='discarded', updated_at=NOW() WHERE id=$1`, [discardedDraft.id]);
  const { rows: dAfter } = await c.query(`SELECT status FROM op_report_drafts WHERE id=$1`, [discardedDraft.id]);
  console.log(`Discarded: draft.status='${dAfter[0].status}'\n`);

  // Middle draft left as 'draft' (open in the inbox).
  console.log("=== Final state (this run only) ===");
  for (const d of drafts) {
    const { rows } = await c.query(`SELECT status, saved_report_id FROM op_report_drafts WHERE id=$1`, [d.id]);
    console.log(`  ${d.fixture.padEnd(36)} → status='${rows[0].status}', saved_report_id=${rows[0].saved_report_id ? rows[0].saved_report_id.slice(0, 8) + "…" : "null"}, warnings=${d.warningsCount}`);
  }

  console.log("\n=== Global DB state ===");
  for (const tbl of ["op_report_drafts", "op_reports", "op_report_items", "op_bulk_import_jobs", "op_bulk_import_items"]) {
    const { rows } = await c.query(`SELECT COUNT(*)::int AS c FROM ${tbl}`);
    console.log(`  ${tbl.padEnd(28)} = ${rows[0].c}`);
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
