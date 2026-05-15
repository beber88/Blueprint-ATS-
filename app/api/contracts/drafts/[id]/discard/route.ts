import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// POST /api/contracts/drafts/:id/discard — flip the draft to 'discarded'.
// We don't actually delete drafts; they stay around for audit.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ct_contract_drafts")
    .update({
      status: "discarded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .neq("status", "saved") // never overwrite a saved draft
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "discard failed (already saved?)" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
