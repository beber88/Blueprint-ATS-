import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/contracts/drafts?status=draft|saved|flagged|discarded&source_kind=manual|bulk|retry&limit=N
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sourceKind = url.searchParams.get("source_kind");
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  let q = supabase
    .from("ct_contract_drafts")
    .select(
      "id, status, source_kind, ai_output_json, warnings_json, saved_contract_id, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));

  if (status) q = q.eq("status", status);
  if (sourceKind) q = q.eq("source_kind", sourceKind);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ drafts: data || [] });
}
