import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeContractWarnings } from "@/lib/contracts/draft-warnings";
import { loadContractSnapshot } from "@/lib/contracts/draft-master-snapshot";
import type { ExtractedContract } from "@/lib/contracts/types";

export const dynamic = "force-dynamic";

// GET /api/contracts/drafts/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ct_contract_drafts")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }
  return NextResponse.json({ draft: data });
}

// PATCH /api/contracts/drafts/:id
// Body: { ai_output: ExtractedContract }
//
// Re-validates the edited AI output, recomputes warnings against the
// current snapshot, and persists. Used by the Preview UI inline-edit.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { ai_output?: ExtractedContract };
  try {
    body = (await request.json()) as { ai_output?: ExtractedContract };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.ai_output || typeof body.ai_output !== "object") {
    return NextResponse.json({ error: "ai_output required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const snapshot = await loadContractSnapshot(supabase);
  const warnings = computeContractWarnings(body.ai_output, snapshot);

  const { data, error } = await supabase
    .from("ct_contract_drafts")
    .update({
      ai_output_json: body.ai_output,
      warnings_json: warnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `update failed: ${error?.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ draft: data, warnings });
}
