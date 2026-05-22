import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SELECT =
  "id, employee_id, leave_type, start_date, end_date, days_count, reason, status, approved_at, rejection_reason, created_at, employee:op_employees!employee_id(id, full_name)";

function inclusiveDayCount(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  return Math.round((e - s) / 86_400_000) + 1;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("hr_leave_requests")
      .select(SELECT)
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

/**
 * POST /api/leave-requests
 * Creates a pending leave request. days_count defaults to the
 * inclusive number of calendar days in the range.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    if (!body.employee_id || !body.leave_type || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: "employee_id, leave_type, start_date, and end_date are required" },
        { status: 400 }
      );
    }
    if (body.end_date < body.start_date) {
      return NextResponse.json({ error: "end_date must be on or after start_date" }, { status: 400 });
    }

    const daysCount =
      body.days_count != null && Number(body.days_count) > 0
        ? Number(body.days_count)
        : inclusiveDayCount(body.start_date, body.end_date);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hr_leave_requests")
      .insert({
        employee_id: body.employee_id,
        leave_type: body.leave_type,
        start_date: body.start_date,
        end_date: body.end_date,
        days_count: daysCount,
        reason: body.reason || null,
        status: "pending",
        source: "manual",
      })
      .select(SELECT)
      .single();

    if (error) {
      console.error("Leave insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Leave POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
