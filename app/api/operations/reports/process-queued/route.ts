import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems } from "@/lib/claude/extract-report";
import { loadContextBlock, trackContextUsage } from "@/lib/operations/context-loader";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/operations/reports/process-queued
 *
 * Processes queued email reports — runs AI extraction on raw_text,
 * creates op_report_items, and updates status to completed.
 * Called by the daily cron.
 */
export async function GET(request: NextRequest) {
  // Auth: cron secret or user session
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();

  // Get queued reports (max 5 per run to stay within time limit)
  const { data: queued } = await supabase
    .from("op_reports")
    .select("id, raw_text, report_date, source_meta")
    .eq("processing_status", "queued")
    .order("report_date", { ascending: false })
    .limit(5);

  if (!queued || queued.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "No queued reports" });
  }

  let processed = 0;
  let failed = 0;

  for (const report of queued) {
    try {
      // Skip if no text content
      if (!report.raw_text || report.raw_text.trim().length < 30) {
        await supabase.from("op_reports").update({
          processing_status: "completed",
          processed_at: new Date().toISOString(),
        }).eq("id", report.id);
        continue;
      }

      // Mark as processing
      await supabase.from("op_reports").update({
        processing_status: "processing",
      }).eq("id", report.id);

      // Load context knowledge
      const contextBlock = await loadContextBlock();

      // Extract with AI
      const extracted = await extractReportItems(report.raw_text, {
        reportDate: report.report_date,
        contextBlock,
      });

      // Create report items
      const itemRows = [];
      for (const it of extracted.items) {
        const empMatch = await matchEmployeeByName(supabase, it.person_responsible);
        const deptId = await matchDepartmentByName(supabase, it.department);
        const projId = await matchProjectByName(supabase, it.project);

        itemRows.push({
          report_id: report.id,
          report_date: report.report_date,
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

      // Mark as completed
      await supabase.from("op_reports").update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        source_meta: {
          ...(report.source_meta as Record<string, unknown> || {}),
          claude_model: extracted.model,
          claude_confidence: extracted.confidence,
          items_extracted: itemRows.length,
        },
      }).eq("id", report.id);

      // Track context usage
      trackContextUsage(report.raw_text).catch(() => {});

      processed++;
    } catch (err) {
      failed++;
      await supabase.from("op_reports").update({
        processing_status: "failed",
        processing_error: err instanceof Error ? err.message : String(err),
      }).eq("id", report.id);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    failed,
    total_queued: queued.length,
  });
}

export const POST = GET;
