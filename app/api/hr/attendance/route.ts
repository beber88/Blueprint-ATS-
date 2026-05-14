import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createAdminClient();
  const date = url.searchParams.get("date");
  const employee_id = url.searchParams.get("employee_id");

  let query = supabase
    .from("hr_attendance")
    .select("*, employee:hr_employees(id, full_name)")
    .order("date", { ascending: false });

  if (date) query = query.eq("date", date);
  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.date)
    return NextResponse.json({ error: "employee_id, date required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_attendance")
    .upsert(
      {
        employee_id: body.employee_id,
        date: body.date,
        clock_in: body.clock_in || null,
        clock_out: body.clock_out || null,
        status: body.status || "present",
        notes: body.notes || null,
      },
      { onConflict: "employee_id,date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}
