import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeWorkedHours } from "@/lib/attendance/hours";

export const dynamic = "force-dynamic";

const SELECT =
  "id, employee_id, date, clock_in, clock_out, break_minutes, total_hours, overtime_hours, status, notes, source, employee:op_employees!employee_id(id, full_name)";

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

/**
 * POST /api/attendance
 * Creates an attendance record. total_hours / overtime_hours are
 * derived from clock_in/clock_out and break_minutes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    if (!body.employee_id || !body.date) {
      return NextResponse.json({ error: "employee_id and date are required" }, { status: 400 });
    }

    const breakMinutes = Number(body.break_minutes) || 0;
    const { total_hours, overtime_hours } = computeWorkedHours(
      body.clock_in || null,
      body.clock_out || null,
      breakMinutes
    );

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hr_attendance")
      .insert({
        employee_id: body.employee_id,
        date: body.date,
        clock_in: body.clock_in || null,
        clock_out: body.clock_out || null,
        break_minutes: breakMinutes,
        total_hours,
        overtime_hours,
        status: body.status || "present",
        notes: body.notes || null,
        source: "manual",
      })
      .select(SELECT)
      .single();

    if (error) {
      console.error("Attendance insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Attendance POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
