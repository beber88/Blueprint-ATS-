import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems } from "@/lib/claude/extract-report";
import { computeWarnings } from "@/lib/operations/draft-warnings";
import { loadMasterSnapshot } from "@/lib/operations/draft-master-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/seed/extract — No-auth version of /api/operations/intake/extract
 * for use by the seed script only.
 */
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  let body: { text: string; reportDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.text || body.text.trim().length < 50) {
    return NextResponse.json(
      { error: "text required (min 50 chars)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const reportDate =
    body.reportDate || new Date().toISOString().slice(0, 10);

  const extracted = await extractReportItems(body.text, { reportDate });

  const aiOutput = {
    report_date: extracted.report_date || reportDate,
    project_id: null,
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
      source_text: body.text.slice(0, 200_000),
      ai_output_json: aiOutput,
      warnings_json: warnings,
      source_kind: "manual",
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

  return NextResponse.json({ draftId: draft.id, warnings });
}
