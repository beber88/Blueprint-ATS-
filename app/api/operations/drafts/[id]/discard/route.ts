import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// POST /api/operations/drafts/:id/discard
// Marks the draft as discarded. Does NOT delete the row — we keep the
// AI's output for audit + future "why was this thrown away" inspection.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("op_report_drafts")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }
  if (existing.status === "saved") {
    return NextResponse.json(
      { error: "draft is already saved — cannot discard" },
      { status: 409 }
    );
  }
  await supabase
    .from("op_report_drafts")
    .update({
      status: "discarded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  return NextResponse.json({ ok: true });
}
