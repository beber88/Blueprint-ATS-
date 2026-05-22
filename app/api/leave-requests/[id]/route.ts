import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminClient = ReturnType<typeof createAdminClient>;

const SELECT =
  "id, employee_id, leave_type, start_date, end_date, days_count, reason, status, approved_at, rejection_reason, created_at, employee:op_employees!employee_id(id, full_name)";

const TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
};

/**
 * Adjusts the employee's leave balance for the year of the request by
 * `delta` days (positive on approval, negative when an approved
 * request is cancelled). Creates the balance row if absent.
 */
async function adjustBalance(
  admin: AdminClient,
  employeeId: string,
  leaveType: string,
  year: number,
  delta: number
) {
  const { data: balance } = await admin
    .from("hr_leave_balances")
    .select("id, used_days")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .eq("leave_type", leaveType)
    .maybeSingle();

  if (balance) {
    const next = Math.max(Number(balance.used_days) + delta, 0);
    await admin.from("hr_leave_balances").update({ used_days: next }).eq("id", balance.id);
  } else if (delta > 0) {
    await admin.from("hr_leave_balances").insert({
      employee_id: employeeId,
      year,
      leave_type: leaveType,
      total_days: 0,
      used_days: delta,
    });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hr_leave_requests")
      .select(SELECT)
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Leave GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/leave-requests/[id]
 * Body: { status: "approved" | "rejected" | "cancelled", rejection_reason? }
 *
 * Approving an unpaid/paid leave consumes the employee's leave balance;
 * cancelling an already-approved request returns those days.
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
    const newStatus: string = body.status;
    if (!newStatus) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: current, error: curErr } = await admin
      .from("hr_leave_requests")
      .select("status, employee_id, leave_type, start_date, days_count")
      .eq("id", id)
      .single();
    if (curErr || !current) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const allowed = TRANSITIONS[current.status] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot move leave request from "${current.status}" to "${newStatus}"`,
        },
        { status: 422 }
      );
    }
    if (newStatus === "rejected" && !body.rejection_reason) {
      return NextResponse.json(
        { error: "rejection_reason is required when rejecting" },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "approved") {
      update.approved_by = user.id;
      update.approved_at = new Date().toISOString();
    }
    if (newStatus === "rejected") {
      update.rejection_reason = body.rejection_reason;
    }

    const { data, error } = await admin
      .from("hr_leave_requests")
      .update(update)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const year = new Date(current.start_date).getFullYear();
    if (newStatus === "approved") {
      await adjustBalance(
        admin,
        current.employee_id,
        current.leave_type,
        year,
        Number(current.days_count)
      );
    } else if (newStatus === "cancelled") {
      await adjustBalance(
        admin,
        current.employee_id,
        current.leave_type,
        year,
        -Number(current.days_count)
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Leave PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
