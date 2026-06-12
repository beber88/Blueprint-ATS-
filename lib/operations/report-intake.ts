import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractReportItems,
  extractReportItemsFromPDF,
} from "@/lib/claude/extract-report";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";
import { loadContextBlock, trackContextUsage } from "@/lib/operations/context-loader";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

/**
 * Unified report intake — the single processing path for daily reports,
 * regardless of how they arrived (manual upload, email attachment, queued
 * row picked up by cron, WhatsApp text). Centralizes:
 *   PDF text extraction (pdf-parse → Claude Vision fallback),
 *   context-aware AI extraction,
 *   project auto-create + employee/department matching,
 *   persisting the AI's clarifying questions (the learning loop),
 *   status/error bookkeeping on op_reports.
 */

const STORAGE_BUCKET = "operations-reports";
const MIN_TEXT_FOR_PARSE = 50; // below this, a PDF is treated as scanned → vision
const MIN_TEXT_TO_PROCESS = 30; // below this with no PDF there is nothing to extract

export interface IntakeSource {
  rawText?: string;
  pdfBuffer?: Buffer;
  sourceType: "pdf" | "text" | "email" | "whatsapp" | "image";
  reportDate?: string | null;
  projectIdHint?: string | null;
  reporterName?: string | null;
  sourceMeta?: Record<string, unknown>;
  locale?: "he" | "en" | "tl";
  /** When false, the row is created as 'queued' and not processed now. */
  processNow?: boolean;
}

export interface IntakeResult {
  ok: boolean;
  reportId: string | null;
  itemsCount: number;
  questionsCount: number;
  confidence: number | null;
  reportDate: string | null;
  notes: string | null;
  status: "completed" | "failed" | "queued" | "skipped";
  error?: string;
}

interface OpReportRow {
  id: string;
  raw_text: string | null;
  report_date: string | null;
  source_meta: Record<string, unknown> | null;
  storage_path?: string | null;
  attempts?: number | null;
}

function failResult(reportId: string | null, error: string): IntakeResult {
  return {
    ok: false,
    reportId,
    itemsCount: 0,
    questionsCount: 0,
    confidence: null,
    reportDate: null,
    notes: null,
    status: "failed",
    error,
  };
}

async function parsePdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(buffer);
    return pdfData.text || "";
  } catch {
    return ""; // scanned/odd PDF — caller falls back to Claude Vision
  }
}

export async function uploadReportPdf(
  supabase: SupabaseClient,
  buffer: Buffer
): Promise<string | null> {
  const path = `${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf" });
  if (error) {
    console.error("report-intake: PDF upload failed", error);
    return null;
  }
  return path;
}

async function downloadReportPdf(
  supabase: SupabaseClient,
  path: string
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) {
    console.error("report-intake: PDF download failed", path, error);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Creates the op_reports row and (by default) runs extraction immediately.
 * Pass processNow: false to enqueue for the cron instead.
 */
export async function createAndProcessReport(src: IntakeSource): Promise<IntakeResult> {
  const supabase = createAdminClient();

  let rawText = src.rawText || "";
  let storagePath: string | null = null;
  const pdfBuffer = src.pdfBuffer || null;

  if (pdfBuffer) {
    if (!rawText.trim()) {
      rawText = await parsePdfText(pdfBuffer);
    }
    storagePath = await uploadReportPdf(supabase, pdfBuffer);
  }

  const usePdfVision = !!pdfBuffer && rawText.trim().length < MIN_TEXT_FOR_PARSE;
  const processNow = src.processNow !== false;

  const { data: report, error: insErr } = await supabase
    .from("op_reports")
    .insert({
      source_type: src.sourceType,
      raw_text: (usePdfVision
        ? `[PDF pending Claude Vision extraction]`
        : rawText
      ).slice(0, 200000),
      source_meta: {
        ...(src.sourceMeta || {}),
        project_id_hint: src.projectIdHint || null,
        pdf_vision: usePdfVision,
      },
      report_date: src.reportDate || new Date().toISOString().slice(0, 10),
      storage_path: storagePath,
      processing_status: processNow ? "processing" : "queued",
    })
    .select()
    .single();

  if (insErr || !report) {
    console.error("report-intake: failed to create report row", insErr);
    return failResult(null, insErr?.message || "Failed to create report row");
  }

  if (!processNow) {
    return {
      ok: true,
      reportId: report.id,
      itemsCount: 0,
      questionsCount: 0,
      confidence: null,
      reportDate: report.report_date,
      notes: null,
      status: "queued",
    };
  }

  return runExtraction(supabase, report as OpReportRow, {
    rawText,
    pdfBuffer,
    projectIdHint: src.projectIdHint || null,
    reporterName: src.reporterName || null,
    locale: src.locale,
  });
}

/**
 * Processes an existing op_reports row (queued/failed). Re-reads the stored
 * PDF when the raw text is insufficient so scanned reports still extract.
 */
export async function processReportRow(reportInput: OpReportRow): Promise<IntakeResult> {
  const supabase = createAdminClient();
  const report = reportInput;
  const meta = (report.source_meta || {}) as Record<string, unknown>;

  const rawText = (report.raw_text || "").trim();
  const placeholder = rawText.startsWith("[") && rawText.endsWith("]");
  let pdfBuffer: Buffer | null = null;

  const storagePath =
    report.storage_path ||
    (typeof meta.pdf_storage_path === "string" ? meta.pdf_storage_path : null);

  if ((rawText.length < MIN_TEXT_FOR_PARSE || placeholder) && storagePath) {
    pdfBuffer = await downloadReportPdf(supabase, storagePath);
  }

  // Nothing to extract from: short text, no recoverable PDF
  if (rawText.length < MIN_TEXT_TO_PROCESS && !pdfBuffer) {
    await supabase
      .from("op_reports")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        source_meta: { ...meta, skipped_reason: "no_extractable_content" },
      })
      .eq("id", report.id);
    return {
      ok: true,
      reportId: report.id,
      itemsCount: 0,
      questionsCount: 0,
      confidence: null,
      reportDate: report.report_date,
      notes: null,
      status: "skipped",
    };
  }

  await supabase
    .from("op_reports")
    .update({
      processing_status: "processing",
      attempts: (report.attempts || 0) + 1,
    })
    .eq("id", report.id);

  const projectIdHint =
    typeof meta.project_id_hint === "string" ? meta.project_id_hint : null;
  const reporterName = typeof meta.from_name === "string" ? meta.from_name : null;

  return runExtraction(supabase, report, {
    rawText: placeholder ? "" : rawText,
    pdfBuffer,
    projectIdHint,
    reporterName,
  });
}

async function runExtraction(
  supabase: SupabaseClient,
  report: OpReportRow,
  input: {
    rawText: string;
    pdfBuffer: Buffer | null;
    projectIdHint: string | null;
    reporterName: string | null;
    locale?: "he" | "en" | "tl";
  }
): Promise<IntakeResult> {
  const meta = (report.source_meta || {}) as Record<string, unknown>;
  const contextBlock = await loadContextBlock(input.projectIdHint);
  const useVision =
    !!input.pdfBuffer && input.rawText.trim().length < MIN_TEXT_FOR_PARSE;

  let extracted;
  try {
    const opts = {
      reportDate: report.report_date,
      contextBlock,
      reporterName: input.reporterName,
      locale: input.locale,
    };
    extracted = useVision
      ? await extractReportItemsFromPDF(input.pdfBuffer!.toString("base64"), opts)
      : await extractReportItems(input.rawText, opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("op_reports")
      .update({
        processing_status: "failed",
        processing_error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", report.id);
    return failResult(report.id, message);
  }

  // Items — match entities, auto-create unknown projects so every mention is tracked
  const autoCreatedProjects = new Map<string, string>();
  const itemRows: Record<string, unknown>[] = [];
  for (const it of extracted.items) {
    const empMatch = await matchEmployeeByName(supabase, it.person_responsible);
    const deptId = await matchDepartmentByName(supabase, it.department);
    let projId = (await matchProjectByName(supabase, it.project)) || input.projectIdHint;

    if (!projId && it.project && it.project.trim().length >= 2) {
      const key = it.project.trim().toLowerCase();
      if (autoCreatedProjects.has(key)) {
        projId = autoCreatedProjects.get(key)!;
      } else {
        const { data: newProj } = await supabase
          .from("op_projects")
          .insert({ name: it.project.trim(), status: "active", department_id: deptId })
          .select("id")
          .single();
        if (newProj) {
          projId = newProj.id;
          autoCreatedProjects.set(key, newProj.id);
        }
      }
    }

    itemRows.push({
      report_id: report.id,
      report_date: extracted.report_date || report.report_date,
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
    if (itErr) console.error("report-intake: failed to insert items", itErr);
  }

  // Learning loop — persist the AI's clarifying questions so they can be
  // answered in the knowledge page and become context entries.
  let questionsCount = 0;
  if (extracted.questions.length > 0) {
    const { error: qErr } = await supabase.from("op_context_questions").insert(
      extracted.questions.map((q) => ({
        report_id: report.id,
        draft_id: null,
        question_text: q.question,
        question_text_en: q.question_en,
        context_snippet: q.context_snippet,
        suggested_type: q.suggested_type,
        suggested_trigger: q.suggested_trigger,
        status: "pending",
      }))
    );
    if (qErr) console.error("report-intake: failed to insert questions", qErr);
    else questionsCount = extracted.questions.length;
  }

  await supabase
    .from("op_reports")
    .update({
      processing_status: "completed",
      processed_at: new Date().toISOString(),
      processing_error: null,
      report_date: extracted.report_date || report.report_date,
      source_meta: {
        ...meta,
        claude_model: extracted.model,
        claude_confidence: extracted.confidence,
        items_extracted: itemRows.length,
        notes: extracted.notes,
      },
    })
    .eq("id", report.id);

  if (input.rawText.trim()) {
    trackContextUsage(input.rawText).catch((err) =>
      console.error("report-intake: trackContextUsage failed", err)
    );
  }

  return {
    ok: true,
    reportId: report.id,
    itemsCount: itemRows.length,
    questionsCount,
    confidence: extracted.confidence,
    reportDate: extracted.report_date || report.report_date,
    notes: extracted.notes,
    status: "completed",
  };
}
