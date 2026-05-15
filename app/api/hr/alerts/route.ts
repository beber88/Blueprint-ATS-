import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employee_id");
  const resolved = url.searchParams.get("resolved");

  let q = supabase.from("hr_alerts").select("*").order("created_at", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (resolved === "false") q = q.is("resolved_at", null);
  else if (resolved === "true") q = q.not("resolved_at", "is", null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data || [] });
}

// PATCH /api/hr/alerts?id=... with { action: 'resolve' } marks it
// resolved. Body shape kept tiny — resolution is the only mutation
// users do on alerts (creation is cron-only).
export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  if (body.action !== "resolve") {
    return NextResponse.json({ error: "action must be 'resolve'" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .is("resolved_at", null)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}
