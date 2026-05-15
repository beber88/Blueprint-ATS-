import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/operations/drafts?status=draft,flagged&source_kind=manual,bulk&severity=high
//
// Defaults: status IN ('draft','flagged') — the working inbox. saved +
// discarded are excluded unless explicitly requested.
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const params = request.nextUrl.searchParams;
  const statusFilter = (params.get("status") || "draft,flagged").split(",");
  const sourceKindFilter = params.get("source_kind");
  const severityFilter = params.get("severity"); // optional: high|medium|low

  const supabase = createAdminClient();
  let q = supabase
    .from("op_report_drafts")
    .select(
      "id, status, source_kind, created_at, updated_at, ai_output_json, warnings_json, saved_report_id, bulk_import_item_id"
    )
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(200);

  if (sourceKindFilter) {
    q = q.in("source_kind", sourceKindFilter.split(","));
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Apply severity filter client-side because Postgres can't filter on
  // the jsonb array shape without a custom operator.
  const filtered = (data || []).filter((d) => {
    if (!severityFilter || severityFilter === "any") return true;
    const ws = (d.warnings_json || []) as Array<{ severity: string }>;
    return ws.some((w) => w.severity === severityFilter);
  });

  return NextResponse.json({ drafts: filtered });
}
