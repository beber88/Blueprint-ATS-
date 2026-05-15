import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteDraft } from "@/lib/operations/draft-promote";
import { requireApiAuth } from "@/lib/api/auth";

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
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
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

  try {
    const result = await promoteDraft(supabase, draft, {
      flagForReview: !!body.flagForReview,
    });
    return NextResponse.json({
      reportId: result.reportId,
      itemsCount: result.itemsCount,
      flagged: !!body.flagForReview,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
