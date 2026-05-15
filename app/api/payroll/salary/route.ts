import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    let query = supabase
      .from("hr_salary")
      .select(
        "id, employee_id, effective_date, base_salary, currency, pay_frequency, allowances, deductions, notes, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .order("effective_date", { ascending: false })
      .limit(200);

    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query;
    if (error) {
      console.error("Salary query error:", error);
      return NextResponse.json({ error: "Failed to fetch salary records" }, { status: 500 });
    }

    return NextResponse.json({ salaries: data || [] });
  } catch (err) {
    console.error("Salary GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
