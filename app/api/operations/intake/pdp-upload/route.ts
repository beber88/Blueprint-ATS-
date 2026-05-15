import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems } from "@/lib/claude/extract-report";
import { computeWarnings } from "@/lib/operations/draft-warnings";
import { loadMasterSnapshot } from "@/lib/operations/draft-master-snapshot";
import { promoteDraft } from "@/lib/operations/draft-promote";
import { requireApiAuth } from "@/lib/api/auth";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  b: Buffer
) => Promise<{ text: string }>;

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/operations/intake/pdp-upload
 *
 * One-step PDP (daily report) upload flow:
 *   1. Accept a PDF file
 *   2. Extract text from the PDF
 *   3. Run Claude AI extraction
 *   4. Create a draft with warnings
 *   5. If autoSave=true AND no high-severity warnings → auto-promote to final report
 *      (items get distributed to op_report_items with proper department/project/person matching)
 *   6. Return the result with a summary of what was distributed
 *
 * This endpoint is the "quick upload" complement to the existing /extract endpoint.
 * The existing /extract always creates a draft for manual review. This one can
 * optionally auto-save if the data looks clean.
 */

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const form = await request.formData();
  const fileField = form.get("file");
  const autoSave = form.get("autoSave") === "true";
  const reportDate = (form.get("reportDate") as string | null) || undefined;
  const projectId = (form.get("projectId") as string | null) || undefined;

  if (!fileField || !(fileField instanceof File) || fileField.size === 0) {
    return NextResponse.json(
      { error: "PDF file required" },
      { status: 400 }
    );
  }

  // Validate file type
  const name = fileField.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".txt")) {
    return NextResponse.json(
      { error: "Only PDF and TXT files are supported" },
      { status: 400 }
    );
  }

  // Extract text from the file
  let text = "";
  const buffer = Buffer.from(await fileField.arrayBuffer());

  if (name.endsWith(".pdf")) {
    try {
      const out = await pdfParse(buffer);
      text = out.text.trim();
    } catch (e) {
      return NextResponse.json(
        { error: `PDF parsing failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 422 }
      );
    }
  } else {
    text = buffer.toString("utf-8").trim();
  }

  if (text.length < 50) {
    return NextResponse.json(
      { error: "Extracted text is too short (min 50 chars). The PDF might be image-only — try copy-pasting the text instead." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const effectiveDate = reportDate || new Date().toISOString().slice(0, 10);

  // Run Claude extraction
  const extracted = await extractReportItems(text, {
    reportDate: effectiveDate,
  });

  const aiOutput = {
    report_date: extracted.report_date || effectiveDate,
    project_id: projectId || null,
    confidence: extracted.confidence,
    model: extracted.model,
    notes: extracted.notes,
    items: extracted.items,
    ceo_action_items: extracted.items.filter((it) => it.ceo_decision_needed),
  };

  // Compute warnings
  const snapshot = await loadMasterSnapshot(supabase);
  const warnings = computeWarnings(aiOutput, snapshot);

  // Create draft
  const { data: draft, error: draftErr } = await supabase
    .from("op_report_drafts")
    .insert({
      source_text: text.slice(0, 200_000),
      ai_output_json: aiOutput,
      warnings_json: warnings,
      source_kind: "manual",
      status: "draft",
    })
    .select()
    .single();

  if (draftErr || !draft) {
    return NextResponse.json(
      { error: `Failed to create draft: ${draftErr?.message}` },
      { status: 500 }
    );
  }

  // Build the distribution summary
  const summary = buildDistributionSummary(extracted.items);

  // Auto-promote if requested and no high-severity warnings
  const hasHighWarnings = warnings.some(
    (w: { severity: string }) => w.severity === "high"
  );

  if (autoSave && !hasHighWarnings) {
    try {
      const result = await promoteDraft(supabase, draft, {
        extraReportMeta: { source_file: fileField.name, pdp_upload: true },
      });
      return NextResponse.json({
        status: "saved",
        draftId: draft.id,
        reportId: result.reportId,
        itemsCount: result.itemsCount,
        warnings,
        summary,
        ai_output: aiOutput,
      });
    } catch (e) {
      // Promotion failed — return the draft for manual review
      return NextResponse.json({
        status: "draft",
        draftId: draft.id,
        reportId: null,
        itemsCount: 0,
        warnings,
        summary,
        ai_output: aiOutput,
        promotionError: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    status: "draft",
    draftId: draft.id,
    reportId: null,
    itemsCount: extracted.items.length,
    warnings,
    warningCount: warnings.length,
    highWarnings: hasHighWarnings,
    summary,
    ai_output: aiOutput,
  });
}

/**
 * Builds a human-readable summary of where the extracted items will be distributed.
 */
function buildDistributionSummary(
  items: Array<{
    category: string;
    ceo_decision_needed: boolean;
    missing_information: string | null;
    status: string;
    priority: string;
    department: string | null;
    project: string | null;
  }>
) {
  const attendance = items.filter((i) => i.category === "attendance");
  const ceoItems = items.filter((i) => i.ceo_decision_needed);
  const missingInfo = items.filter((i) => i.missing_information);
  const urgent = items.filter((i) => i.priority === "urgent");
  const blocked = items.filter((i) => i.status === "blocked");
  const projects = Array.from(new Set(items.map((i) => i.project).filter(Boolean)));
  const departments = Array.from(
    new Set(items.map((i) => i.department).filter(Boolean))
  );

  return {
    totalItems: items.length,
    attendance: {
      count: attendance.length,
      label: "Attendance items → Attendance view",
    },
    ceoDecisions: {
      count: ceoItems.length,
      label: "CEO decisions → CEO Action Items",
    },
    missingInfo: {
      count: missingInfo.length,
      label: "Missing info → Missing Information tracker",
    },
    urgentAlerts: {
      count: urgent.length,
      label: "Urgent items → Alerts",
    },
    blockers: {
      count: blocked.length,
      label: "Blocked items → Issues view",
    },
    projects: {
      count: projects.length,
      names: projects,
      label: "Projects covered",
    },
    departments: {
      count: departments.length,
      names: departments,
      label: "Departments covered",
    },
  };
}
