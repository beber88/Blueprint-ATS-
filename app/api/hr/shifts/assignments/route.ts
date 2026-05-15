import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();
  const employee_id = url.searchParams.get("employee_id");
  const date = url.searchParams.get("date");

  let query = supabase
    .from("hr_shift_assignments")
    .select("*, employee:hr_employees(id, full_name), shift:hr_shift_definitions(id, name, start_time, end_time)")
    .order("date", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (date) query = query.eq("date", date);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.shift_id || !body.date)
    return NextResponse.json({ error: "employee_id, shift_id, date required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_shift_assignments")
    .insert({
      employee_id: body.employee_id,
      shift_id: body.shift_id,
      date: body.date,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
