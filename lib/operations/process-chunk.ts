import type { SupabaseClient } from "@supabase/supabase-js";
import { extractReportItems } from "@/lib/claude/extract-report";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";

export interface ProcessChunkResult {
  reportId: string;
  itemsCount: number;
  claudeModel?: string;
  claudeConfidence?: number;
}

// Inserts an op_reports row for a single chunk, runs Claude extraction,
// inserts the matched op_report_items rows, and marks the report completed.
// On failure, marks the report as failed and re-throws so the caller (the
// bulk-import worker) can mark its item as failed too.
export async function processChunk(
  supabase: SupabaseClient,
  chunk: string,
  reportDate: string,
  defaultProjectId?: string | null,
  extraMeta: Record<string, unknown> = {}
): Promise<ProcessChunkResult> {
  const { data: report, error: insErr } = await supabase
    .from("op_reports")
    .insert({
      source_type: "text",
      raw_text: chunk.slice(0, 200_000),
      source_meta: { bulk_import: true, ...extraMeta },
      report_date: reportDate,
      processing_status: "processing",
    })
    .select()
    .single();

  if (insErr || !report) {
    throw new Error(`failed to insert op_reports row: ${insErr?.message || "unknown"}`);
  }

  try {
    const extracted = await extractReportItems(chunk, { reportDate });
    const itemRows: Record<string, unknown>[] = [];
    for (const it of extracted.items) {
      const empMatch = await matchEmployeeByName(supabase, it.person_responsible);
      const deptId = await matchDepartmentByName(supabase, it.department);
      const projId =
        (await matchProjectByName(supabase, it.project)) || defaultProjectId || null;
      itemRows.push({
        report_id: report.id,
        report_date: reportDate,
        department_id: deptId,
        department_raw: it.department,
        project_id: projId,
        project_raw: it.project,
        person_responsible_id: empMatch.employee_id,
        person_responsible_raw: it.person_responsible,
        person_responsible_match_confidence: empMatch.confidence || null,
        issue: it.issue,
        status: it.status,
        deadline: it.deadline,
        deadline_raw: it.deadline_raw,
        deadline_uncertain: it.deadline_uncertain,
        missing_information: it.missing_information,
        ceo_decision_needed: it.ceo_decision_needed,
        priority: it.priority,
        next_action: it.next_action,
        category: it.category,
      });
    }
    if (itemRows.length > 0) {
      await supabase.from("op_report_items").insert(itemRows);
    }
    await supabase
      .from("op_reports")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        source_meta: {
          bulk_import: true,
          ...extraMeta,
          claude_confidence: extracted.confidence,
          claude_model: extracted.model,
          notes: extracted.notes,
        },
      })
      .eq("id", report.id);
    return {
      reportId: report.id,
      itemsCount: itemRows.length,
      claudeModel: extracted.model,
      claudeConfidence: extracted.confidence,
    };
  } catch (e) {
    await supabase
      .from("op_reports")
      .update({
        processing_status: "failed",
        processing_error: e instanceof Error ? e.message : String(e),
        processed_at: new Date().toISOString(),
      })
      .eq("id", report.id);
    throw e;
  }
}
