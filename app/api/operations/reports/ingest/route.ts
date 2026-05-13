import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems } from "@/lib/claude/extract-report";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["pdf", "txt"];

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfigured: Supabase credentials missing" }, { status: 500 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const supabase = createAdminClient();
    const contentType = request.headers.get("content-type") || "";

    let rawText = "";
    let sourceType: "pdf" | "text" = "text";
    let reportDate: string | null = null;
    let projectIdHint: string | null = null;
    let storagePath: string | null = null;
    let originalFileName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const textField = formData.get("text") as string | null;
      reportDate = (formData.get("reportDate") as string | null) || null;
      projectIdHint = (formData.get("projectId") as string | null) || null;

      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
        }
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
          return NextResponse.json({ error: "Only PDF or TXT files supported on web upload" }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        if (ext === "pdf") {
          sourceType = "pdf";
          const pdfData = await pdfParse(buffer);
          rawText = pdfData.text || "";
          const path = `${crypto.randomUUID()}.pdf`;
          const { error: upErr } = await supabase.storage
            .from("operations-reports")
            .upload(path, buffer, { contentType: file.type || "application/pdf" });
          if (!upErr) storagePath = path;
        } else {
          rawText = buffer.toString("utf8");
        }
        originalFileName = file.name;
      } else if (textField) {
        rawText = textField;
      }
    } else {
      const body = await request.json().catch(() => null);
      if (body && typeof body.text === "string") {
        rawText = body.text;
        reportDate = body.reportDate || null;
        projectIdHint = body.projectId || null;
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: "No report text supplied" }, { status: 400 });
    }

    // Create the report row first
    const { data: report, error: insErr } = await supabase
      .from("op_reports")
      .insert({
        source_type: sourceType,
        raw_text: rawText.slice(0, 200000),
        source_meta: {
          original_filename: originalFileName,
          project_id_hint: projectIdHint,
        },
        report_date: reportDate || new Date().toISOString().slice(0, 10),
        storage_path: storagePath,
        processing_status: "processing",
      })
      .select()
      .single();

    if (insErr || !report) {
      console.error("ingest: failed to create report row", insErr);
      return NextResponse.json({ error: insErr?.message || "Failed to create report" }, { status: 500 });
    }

    let extracted;
    try {
      extracted = await extractReportItems(rawText, { reportDate: report.report_date });
    } catch (err) {
      await supabase
        .from("op_reports")
        .update({
          processing_status: "failed",
          processing_error: err instanceof Error ? err.message : String(err),
          processed_at: new Date().toISOString(),
        })
        .eq("id", report.id);
      return NextResponse.json({ error: "AI extraction failed", details: String(err) }, { status: 500 });
    }

    const itemRows = [] as Record<string, unknown>[];
    for (const it of extracted.items) {
      const empMatch = await matchEmployeeByName(supabase, it.person_responsible);
      const deptId = await matchDepartmentByName(supabase, it.department);
      const projId = (await matchProjectByName(supabase, it.project)) || projectIdHint;
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
      const { error: itErr } = await supabase.from("op_report_items").insert(itemRows);
      if (itErr) console.error("ingest: failed to insert items", itErr);
    }

    await supabase
      .from("op_reports")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        source_meta: {
          original_filename: originalFileName,
          project_id_hint: projectIdHint,
          claude_model: extracted.model,
          claude_confidence: extracted.confidence,
          notes: extracted.notes,
        },
      })
      .eq("id", report.id);

    return NextResponse.json({
      report_id: report.id,
      items_count: itemRows.length,
      confidence: extracted.confidence,
      report_date: report.report_date,
      notes: extracted.notes,
    });
  } catch (error) {
    console.error("ingest: unhandled", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
