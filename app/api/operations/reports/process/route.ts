import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems, extractReportItemsFromImage } from "@/lib/claude/extract-report";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";
import { downloadTwilioMedia } from "@/lib/twilio/whatsapp-media";
import { sendWhatsApp } from "@/lib/twilio/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Internal endpoint — invoked fire-and-forget from the Twilio webhook to keep
// the webhook ack within Twilio's 15s window. Reads a queued op_reports row,
// downloads media, extracts items via Claude, persists them, and replies on
// WhatsApp with a summary.

interface ProcessBody {
  report_id: string;
}

function classifyImage(contentType: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
  if (ct.includes("png")) return "image/png";
  if (ct.includes("webp")) return "image/webp";
  if (ct.includes("gif")) return "image/gif";
  return null;
}

export async function POST(request: NextRequest) {
  let reportId: string | null = null;
  try {
    const body = (await request.json()) as ProcessBody;
    reportId = body.report_id;
    if (!reportId) return NextResponse.json({ error: "report_id required" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: report } = await supabase.from("op_reports").select("*").eq("id", reportId).single();
    if (!report) return NextResponse.json({ error: "report not found" }, { status: 404 });

    await supabase.from("op_reports").update({ processing_status: "processing" }).eq("id", reportId);

    // Resolve reporter context
    let reporterName: string | null = null;
    let defaultProjectName: string | null = null;
    if (report.submitted_by_employee_id) {
      const { data: emp } = await supabase
        .from("op_employees")
        .select("full_name, project_id")
        .eq("id", report.submitted_by_employee_id)
        .maybeSingle();
      reporterName = emp?.full_name || null;
      if (emp?.project_id) {
        const { data: proj } = await supabase.from("op_projects").select("name").eq("id", emp.project_id).maybeSingle();
        defaultProjectName = proj?.name || null;
      }
    }

    // Build text corpus from raw_text + any media attachments
    let corpusText = report.raw_text || "";
    let combinedExtracted: Awaited<ReturnType<typeof extractReportItems>> | null = null;

    const mediaUrls: string[] = Array.isArray(report.source_meta?.media_urls) ? report.source_meta.media_urls : [];
    const imageItems: Awaited<ReturnType<typeof extractReportItemsFromImage>>[] = [];

    for (const url of mediaUrls) {
      try {
        const { buffer, contentType } = await downloadTwilioMedia(url);
        if (contentType.includes("pdf")) {
          const pdfData = await pdfParse(buffer);
          corpusText += "\n\n--- ATTACHED PDF ---\n" + (pdfData.text || "");
        } else {
          const mediaType = classifyImage(contentType);
          if (mediaType) {
            const base64 = buffer.toString("base64");
            const imgRes = await extractReportItemsFromImage(base64, mediaType, {
              reporterName,
              defaultProject: defaultProjectName,
              reportDate: report.report_date,
            });
            imageItems.push(imgRes);
          } else {
            console.warn(`process: unsupported media type ${contentType} url=${url}`);
          }
        }
      } catch (e) {
        console.error("process: media download/parse failed", { url, error: e });
      }
    }

    if (corpusText.trim().length > 0) {
      combinedExtracted = await extractReportItems(corpusText, {
        reporterName,
        defaultProject: defaultProjectName,
        reportDate: report.report_date,
      });
    }

    // Merge text-extracted + image-extracted items
    const allItems = [
      ...(combinedExtracted?.items || []),
      ...imageItems.flatMap((r) => r.items),
    ];

    const itemRows: Record<string, unknown>[] = [];
    for (const it of allItems) {
      const empMatch = await matchEmployeeByName(supabase, it.person_responsible);
      const deptId = await matchDepartmentByName(supabase, it.department);
      const projId = await matchProjectByName(supabase, it.project);
      itemRows.push({
        report_id: reportId,
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
      const { error: itErr } = await supabase.from("op_report_items").insert(itemRows);
      if (itErr) console.error("process: failed to insert items", itErr);
    }

    const overallConfidence =
      combinedExtracted?.confidence ??
      (imageItems.length > 0
        ? imageItems.reduce((s, r) => s + r.confidence, 0) / imageItems.length
        : 0);
    const aggregateNotes =
      [combinedExtracted?.notes, ...imageItems.map((i) => i.notes)].filter(Boolean).join(" | ") || null;

    await supabase
      .from("op_reports")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        source_meta: {
          ...(report.source_meta || {}),
          claude_confidence: overallConfidence,
          claude_model: combinedExtracted?.model || imageItems[0]?.model || null,
          notes: aggregateNotes,
        },
      })
      .eq("id", reportId);

    // Notify the WhatsApp sender that processing completed (best-effort)
    if (report.source_type === "whatsapp" && report.submitted_by_phone) {
      const urgentCount = itemRows.filter((r) => r.priority === "urgent").length;
      const ceoCount = itemRows.filter((r) => r.ceo_decision_needed).length;
      const summary = `הדוח עובד בהצלחה ✓\nנוספו ${itemRows.length} פריטים${urgentCount ? `, מתוכם ${urgentCount} דחופים` : ""}${ceoCount ? `, ${ceoCount} מצריכים החלטת מנכ"ל` : ""}.`;
      try {
        await sendWhatsApp(report.submitted_by_phone, summary);
      } catch (e) {
        console.error("process: failed to send confirmation WhatsApp", e);
      }
    }

    return NextResponse.json({ ok: true, report_id: reportId, items: itemRows.length });
  } catch (error) {
    console.error("process: unhandled", error);
    if (reportId) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from("op_reports")
          .update({
            processing_status: "failed",
            processing_error: error instanceof Error ? error.message : String(error),
            processed_at: new Date().toISOString(),
          })
          .eq("id", reportId);
      } catch { /* noop */ }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}
