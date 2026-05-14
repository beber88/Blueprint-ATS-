import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeWarnings, type AiOutput } from "@/lib/operations/draft-warnings";
import { loadMasterSnapshot } from "@/lib/operations/draft-master-snapshot";

export const dynamic = "force-dynamic";

// GET /api/operations/drafts/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_report_drafts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }
  return NextResponse.json({ draft: data });
}

// PATCH /api/operations/drafts/:id
// Body: { ai_output: AiOutput }
// Recomputes warnings from the new ai_output and returns the updated draft.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { ai_output?: AiOutput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.ai_output || typeof body.ai_output !== "object") {
    return NextResponse.json(
      { error: "ai_output object required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Block edits on non-draft statuses to prevent silent overwrite.
  const { data: existing } = await supabase
    .from("op_report_drafts")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }
  if (existing.status !== "draft" && existing.status !== "flagged") {
    return NextResponse.json(
      { error: `draft is ${existing.status} — cannot edit` },
      { status: 409 }
    );
  }

  const snapshot = await loadMasterSnapshot(supabase);
  const warnings = computeWarnings(body.ai_output, snapshot);

  const { data, error } = await supabase
    .from("op_report_drafts")
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
