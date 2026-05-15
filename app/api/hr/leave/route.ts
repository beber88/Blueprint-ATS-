import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();
  const status = url.searchParams.get("status");
  const employee_id = url.searchParams.get("employee_id");

  let query = supabase
    .from("hr_leave_requests")
    .select("*, employee:hr_employees(id, full_name, email, department)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leave_requests: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.leave_type || !body.start_date || !body.end_date)
    return NextResponse.json({ error: "employee_id, leave_type, start_date, end_date required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_leave_requests")
    .insert({
      employee_id: body.employee_id,
      leave_type: body.leave_type,
      start_date: body.start_date,
      end_date: body.end_date,
      days: body.days || null,
      reason: body.reason || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leave_request: data });
}
