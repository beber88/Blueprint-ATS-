import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("hr_leave_requests")
      .select(
        "id, employee_id, leave_type, start_date, end_date, days_count, reason, status, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      console.error("Leave query error:", error);
      return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error("Leave GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
