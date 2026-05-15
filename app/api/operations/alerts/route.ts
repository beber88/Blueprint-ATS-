import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const url = new URL(request.url);
  const includeResolved = url.searchParams.get("include_resolved") === "true";
  const supabase = createAdminClient();

  let query = supabase
    .from("op_alerts")
    .select("*, item:op_report_items(id, issue, priority, deadline, department_id, project_id), project:op_projects(id, name)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!includeResolved) query = query.is("resolved_at", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data || [] });
}
