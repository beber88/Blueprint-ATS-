import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteDraft } from "@/lib/operations/draft-promote";

export const dynamic = "force-dynamic";

/**
 * POST /api/seed/promote/:id — No-auth version of /api/operations/drafts/:id/save
 * for use by the seed script only.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: draft, error: fetchErr } = await supabase
    .from("op_report_drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !draft) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }

  if (draft.status !== "draft" && draft.status !== "flagged") {
    return NextResponse.json(
      { error: `draft status is ${draft.status}, cannot save` },
      { status: 409 }
    );
  }

  try {
    const result = await promoteDraft(supabase, draft, { flagForReview: false });
    return NextResponse.json({
      reportId: result.reportId,
      itemsCount: result.itemsCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
