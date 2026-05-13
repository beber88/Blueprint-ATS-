import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/operations/drafts/:id/save
// Body: { flagForReview?: boolean, force?: boolean }
//
// Promotes the draft to a real op_reports + op_report_items rows.
// If high-severity warnings exist and `force` is not set, returns 409 so
// the UI can show a confirmation dialog.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { flagForReview?: boolean; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // body optional
  }

  const supabase = createAdminClient();

  const { data: draft, error: draftErr } = await supabase
    .from("op_report_drafts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (draftErr || !draft) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }
  if (draft.status === "saved") {
    return NextResponse.json(
      { error: "draft is already saved", reportId: draft.saved_report_id },
      { status: 409 }
    );
  }
  if (draft.status === "discarded") {
    return NextResponse.json(
      { error: "draft was discarded" },
      { status: 409 }
    );
  }

  const warnings = (draft.warnings_json || []) as Array<{ severity: string }>;
  const highCount = warnings.filter((w) => w.severity === "high").length;
  if (highCount > 0 && !body.force) {
    return NextResponse.json(
      {
        error: `${highCount} high-severity warning(s). Set force=true to save anyway.`,
        highWarnings: highCount,
      },
      { status: 409 }
    );
  }

  const ai = (draft.ai_output_json || {}) as {
    report_date?: string;
    project_id?: string | null;
    confidence?: number;
    model?: string;
    notes?: string | null;
    items?: Array<Record<string, unknown>>;
  };
  const reportDate = ai.report_date || new Date().toISOString().slice(0, 10);

  // 1. Insert the op_reports row.
  const { data: report, error: rErr } = await supabase
    .from("op_reports")
    .insert({
      source_type: "text",
      raw_text: (draft.source_text || "").slice(0, 200_000),
      source_meta: {
        from_draft: true,
        claude_confidence: ai.confidence,
        claude_model: ai.model,
        notes: ai.notes,
      },
      report_date: reportDate,
      processing_status: "completed",
      processed_at: new Date().toISOString(),
      flagged_for_review: !!body.flagForReview,
      draft_source_id: draft.id,
    })
    .select()
    .single();
  if (rErr || !report) {
    return NextResponse.json(
      { error: `failed to create report: ${rErr?.message}` },
      { status: 500 }
    );
  }

  // 2. Insert items with FK matchers run server-side.
  const itemRows: Record<string, unknown>[] = [];
  for (const it of ai.items || []) {
    const issue = (it.issue as string) || "";
    if (!issue) continue;
    const department = it.department as string | null;
    const project = it.project as string | null;
    const person = it.person_responsible as string | null;
    const empMatch = await matchEmployeeByName(supabase, person);
    const deptId = await matchDepartmentByName(supabase, department);
    const projId =
      (await matchProjectByName(supabase, project)) || ai.project_id || null;
    itemRows.push({
      report_id: report.id,
      report_date: reportDate,
      department_id: deptId,
      department_raw: department,
      project_id: projId,
      project_raw: project,
      person_responsible_id: empMatch.employee_id,
      person_responsible_raw: person,
      person_responsible_match_confidence: empMatch.confidence || null,
      issue,
      status: (it.status as string) || "open",
      deadline: (it.deadline as string) || null,
      deadline_raw: (it.deadline_raw as string) || null,
      deadline_uncertain: !!it.deadline_uncertain,
      missing_information: (it.missing_information as string) || null,
      ceo_decision_needed: !!it.ceo_decision_needed,
      priority: (it.priority as string) || "medium",
      next_action: (it.next_action as string) || null,
      category: (it.category as string) || "other",
    });
  }
  if (itemRows.length > 0) {
    const { error: iErr } = await supabase
      .from("op_report_items")
      .insert(itemRows);
    if (iErr) {
      // Roll back the report so the operator can retry cleanly.
      await supabase.from("op_reports").delete().eq("id", report.id);
      return NextResponse.json(
        { error: `failed to create items: ${iErr.message}` },
        { status: 500 }
      );
    }
  }

  // 3. Mark the draft.
  await supabase
    .from("op_report_drafts")
    .update({
      status: body.flagForReview ? "flagged" : "saved",
      saved_report_id: report.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  return NextResponse.json({
    reportId: report.id,
    itemsCount: itemRows.length,
    flagged: !!body.flagForReview,
  });
}
