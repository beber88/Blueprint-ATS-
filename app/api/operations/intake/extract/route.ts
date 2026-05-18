import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems, extractReportItemsFromPDF } from "@/lib/claude/extract-report";
import { computeWarnings } from "@/lib/operations/draft-warnings";
import { loadMasterSnapshot } from "@/lib/operations/draft-master-snapshot";
import { requireApiAuth } from "@/lib/api/auth";
import { loadContextBlock, trackContextUsage } from "@/lib/operations/context-loader";

// Match the require pattern used by /api/cv/upload — pdf-parse has a
// top-level side effect on its index that breaks Next's bundler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  b: Buffer
) => Promise<{ text: string }>;

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/operations/intake/extract
//
// Accepts either:
//   - application/json: { text, reportDate?, projectId? }
//   - multipart/form-data: file (PDF) and/or text, with optional reportDate/projectId fields
//
// Runs the AI extraction and persists the result as a DRAFT (not yet a
// real op_reports row). The Preview UI then GETs the draft, lets the
// operator edit, and posts to /save when ready.

interface JsonBody {
  text: string;
  reportDate?: string;
  projectId?: string;
}

async function parseInputs(request: NextRequest): Promise<{
  text: string;
  reportDate?: string;
  projectId?: string;
  pdfBase64?: string;
} | { error: string; status: number }> {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    let body: JsonBody;
    try {
      body = (await request.json()) as JsonBody;
    } catch {
      return { error: "invalid JSON body", status: 400 };
    }
    return {
      text: body.text || "",
      reportDate: body.reportDate,
      projectId: body.projectId,
    };
  }
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const fileField = form.get("file");
    let text = (form.get("text") as string | null) || "";
    let pdfBase64: string | undefined;
    if (fileField && fileField instanceof File && fileField.size > 0) {
      const buffer = Buffer.from(await fileField.arrayBuffer());
      try {
        const out = await pdfParse(buffer);
        text = (text + "\n" + out.text).trim();
      } catch {
        // pdf-parse failed — will fall back to Claude Vision PDF extraction
      }
      // If text extraction produced insufficient text, retain the raw PDF
      // buffer so the caller can fall back to Claude's native PDF reading.
      if (text.trim().length < 50) {
        pdfBase64 = buffer.toString("base64");
      }
    }
    return {
      text,
      pdfBase64,
      reportDate: (form.get("reportDate") as string | null) || undefined,
      projectId: (form.get("projectId") as string | null) || undefined,
    };
  }
  return { error: `unsupported content-type: ${ct}`, status: 415 };
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const parsed = await parseInputs(request);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const hasPdfFallback = !!parsed.pdfBase64;
  if ((!parsed.text || parsed.text.trim().length < 50) && !hasPdfFallback) {
    return NextResponse.json(
      { error: "text required (min 50 chars; PDF must produce text)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const reportDate =
    parsed.reportDate || new Date().toISOString().slice(0, 10);

  // Load learned context to inject into AI prompt
  const contextBlock = await loadContextBlock(parsed.projectId);

  // Use Claude's native PDF reading when pdf-parse produced insufficient text
  const extracted = hasPdfFallback && parsed.text.trim().length < 50
    ? await extractReportItemsFromPDF(parsed.pdfBase64!, { reportDate, contextBlock })
    : await extractReportItems(parsed.text, { reportDate, contextBlock });

  const aiOutput = {
    report_date: reportDate,
    project_id: parsed.projectId || null,
    confidence: extracted.confidence,
    model: extracted.model,
    notes: extracted.notes,
    items: extracted.items,
    ceo_action_items: extracted.items.filter((it) => it.ceo_decision_needed),
  };

  const snapshot = await loadMasterSnapshot(supabase);
  const warnings = computeWarnings(aiOutput, snapshot);

  const { data: draft, error } = await supabase
    .from("op_report_drafts")
    .insert({
      source_text: parsed.text.slice(0, 200_000),
      ai_output_json: aiOutput,
      warnings_json: warnings,
      questions_json: extracted.questions,
      source_kind: hasPdfFallback ? "pdf_vision" : "manual",
      status: "draft",
    })
    .select()
    .single();

  if (error || !draft) {
    return NextResponse.json(
      { error: `failed to create draft: ${error?.message}` },
      { status: 500 }
    );
  }

  // Persist AI questions to the questions table
  if (extracted.questions.length > 0) {
    await supabase.from("op_context_questions").insert(
      extracted.questions.map((q) => ({
        draft_id: draft.id,
        question_text: q.question,
        question_text_en: q.question_en,
        context_snippet: q.context_snippet,
        suggested_type: q.suggested_type,
        suggested_trigger: q.suggested_trigger,
        status: "pending",
      }))
    );
  }

  // Track which context entries were used (fire-and-forget)
  trackContextUsage(parsed.text).catch(() => {});

  return NextResponse.json({
    draftId: draft.id,
    warnings,
    questions: extracted.questions,
    ai_output: aiOutput,
  });
}
