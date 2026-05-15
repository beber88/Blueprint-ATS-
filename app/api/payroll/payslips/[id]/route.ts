import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["approved", "imported"],
  imported: ["approved", "draft"],
  approved: ["paid", "draft"],
  paid: [],
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("hr_payslips")
      .select(
        "id, employee_id, period_start, period_end, gross_pay, total_deductions, net_pay, breakdown, storage_path, status, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Payslip GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/payroll/payslips/[id]
 * Body: { status }
 *
 * Enforces the payslip lifecycle: draft/imported → approved → paid.
 * Paid payslips are terminal.
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
    const newStatus = body.status;

    if (!newStatus) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: current, error: curErr } = await admin
      .from("hr_payslips")
      .select("status")
      .eq("id", id)
      .single();

    if (curErr || !current) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    const allowed = TRANSITIONS[current.status] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot move payslip from "${current.status}" to "${newStatus}"`,
        },
        { status: 422 }
      );
    }

    const { data, error } = await admin
      .from("hr_payslips")
      .update({ status: newStatus })
      .eq("id", id)
      .select(
        "id, employee_id, period_start, period_end, gross_pay, total_deductions, net_pay, breakdown, status, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Payslip PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
