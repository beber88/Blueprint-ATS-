import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAlerts } from "@/lib/contracts/queries";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/contracts/alerts?resolved=false|true&limit=N
// Defaults to unresolved.
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const resolvedParam = url.searchParams.get("resolved");
  let resolved: boolean | undefined;
  if (resolvedParam === "true") resolved = true;
  else if (resolvedParam === "false") resolved = false;
  else resolved = false;

  try {
    const data = await listAlerts(supabase, {
      resolved,
      limit: url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!, 10)
        : undefined,
    });
    return NextResponse.json({ alerts: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// PATCH /api/contracts/alerts
// Body: { id: string, resolved?: boolean }
// Sets resolved_at = NOW() (resolved=true) or NULL (resolved=false).
export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.id !== "string") {
    return NextResponse.json({ error: "body.id required" }, { status: 400 });
  }
  const resolvedAt = body.resolved === false ? null : new Date().toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ct_alerts")
    .update({ resolved_at: resolvedAt })
    .eq("id", body.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "alert not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ alert: data });
}
