import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = supabase
      .from("hr_attendance")
      .select(
        "id, employee_id, date, clock_in, clock_out, total_hours, overtime_hours, status, source, employee:op_employees!employee_id(id, full_name)"
      )
      .order("date", { ascending: false })
      .limit(500);

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data, error } = await query;
    if (error) {
      console.error("Attendance query error:", error);
      return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
    }

    return NextResponse.json({ records: data || [] });
  } catch (err) {
    console.error("Attendance GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
