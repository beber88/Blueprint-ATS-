import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeWorkedHours } from "@/lib/attendance/hours";

export const dynamic = "force-dynamic";

const SELECT =
  "id, employee_id, date, clock_in, clock_out, break_minutes, total_hours, overtime_hours, status, notes, source, employee:op_employees!employee_id(id, full_name)";

/**
 * PATCH /api/attendance/[id]
 * Edits an attendance record; recomputes hours whenever a time field
 * changes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const { data: current, error: curErr } = await admin
      .from("hr_attendance")
      .select("clock_in, clock_out, break_minutes")
      .eq("id", id)
      .single();
    if (curErr || !current) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    for (const f of ["date", "clock_in", "clock_out", "status", "notes"]) {
      if (f in body) update[f] = body[f];
    }
    if ("break_minutes" in body) update.break_minutes = Number(body.break_minutes) || 0;

    const clockIn = "clock_in" in body ? body.clock_in : current.clock_in;
    const clockOut = "clock_out" in body ? body.clock_out : current.clock_out;
    const breakMin =
      "break_minutes" in body ? Number(body.break_minutes) || 0 : current.break_minutes || 0;
    const { total_hours, overtime_hours } = computeWorkedHours(clockIn, clockOut, breakMin);
    update.total_hours = total_hours;
    update.overtime_hours = overtime_hours;

    const { data, error } = await admin
      .from("hr_attendance")
      .update(update)
      .eq("id", id)
      .select(SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Attendance PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("hr_attendance").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Attendance DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
