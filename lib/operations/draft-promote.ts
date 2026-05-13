import type { SupabaseClient } from "@supabase/supabase-js";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";

interface DraftRow {
  id: string;
  source_text: string;
  ai_output_json: {
    report_date?: string;
    project_id?: string | null;
    confidence?: number;
    model?: string;
    notes?: string | null;
    items?: Array<Record<string, unknown>>;
  };
  status: string;
  saved_report_id?: string | null;
}

export interface PromoteResult {
  reportId: string;
  itemsCount: number;
}

// Shared logic used by both /api/operations/drafts/:id/save and the
// bulk-import auto-promote worker. Inserts the op_reports row + the
// matched op_report_items, then updates the draft.
//
// Rolls back the report on items-insert failure.
export async function promoteDraft(
  supabase: SupabaseClient,
  draft: DraftRow,
  opts: { flagForReview?: boolean; extraReportMeta?: Record<string, unknown> } = {}
): Promise<PromoteResult> {
  const ai = draft.ai_output_json || {};
  const reportDate = ai.report_date || new Date().toISOString().slice(0, 10);

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
        ...(opts.extraReportMeta || {}),
      },
      report_date: reportDate,
      processing_status: "completed",
      processed_at: new Date().toISOString(),
      flagged_for_review: !!opts.flagForReview,
      draft_source_id: draft.id,
    })
    .select()
    .single();
  if (rErr || !report) {
    throw new Error(`failed to create op_reports row: ${rErr?.message}`);
  }

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
      // Roll back the report so the caller can retry cleanly.
      await supabase.from("op_reports").delete().eq("id", report.id);
      throw new Error(`failed to create op_report_items: ${iErr.message}`);
    }
  }

  await supabase
    .from("op_report_drafts")
    .update({
      status: opts.flagForReview ? "flagged" : "saved",
      saved_report_id: report.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  return { reportId: report.id, itemsCount: itemRows.length };
}
