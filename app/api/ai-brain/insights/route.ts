import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();

  let query = supabase
    .from("hr_brain_insights")
    .select("*, department:op_departments(name)")
    .order("created_at", { ascending: false });

  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const severity = url.searchParams.get("severity");
  const department_id = url.searchParams.get("department_id");

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (severity) query = query.eq("severity", severity);
  if (department_id) query = query.eq("department_id", department_id);

  const limit = parseInt(url.searchParams.get("limit") || "100");
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with department name
  const insights = (data || []).map(ins => ({
    ...ins,
    department_name: (ins.department as { name?: string } | null)?.name || null,
  }));

  return NextResponse.json({ insights });
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "resolved") {
    update.resolved_at = new Date().toISOString();
    if (body.resolved_by) update.resolved_by = body.resolved_by;
  }

  const { data, error } = await supabase
    .from("hr_brain_insights")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ insight: data });
}
