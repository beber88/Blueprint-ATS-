import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.action)
    return NextResponse.json({ error: "employee_id, action (clock_in|clock_out) required" }, { status: 400 });

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  if (body.action === "clock_in") {
    const { data, error } = await supabase
      .from("hr_attendance")
      .upsert(
        { employee_id: body.employee_id, date: today, clock_in: now, status: "present" },
        { onConflict: "employee_id,date" }
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendance: data });
  }

  if (body.action === "clock_out") {
    const { data, error } = await supabase
      .from("hr_attendance")
      .update({ clock_out: now })
      .eq("employee_id", body.employee_id)
      .eq("date", today)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendance: data });
  }

  return NextResponse.json({ error: "action must be clock_in or clock_out" }, { status: 400 });
}
