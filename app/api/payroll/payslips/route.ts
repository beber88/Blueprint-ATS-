import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    let query = supabase
      .from("hr_payslips")
      .select(
        "id, employee_id, period_start, period_end, gross_pay, total_deductions, net_pay, status, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .order("period_end", { ascending: false })
      .limit(200);

    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query;
    if (error) {
      console.error("Payslips query error:", error);
      return NextResponse.json({ error: "Failed to fetch payslips" }, { status: 500 });
    }

    return NextResponse.json({ payslips: data || [] });
  } catch (err) {
    console.error("Payslips GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
