import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

/**
 * POST /api/payroll/salary
 *
 * Records a salary adjustment. Salary history is effective-dated: each
 * adjustment is a new immutable row; the current salary for an employee
 * is the latest row with effective_date <= today. Prior rows are kept
 * for payslip recomputation and audit.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    const { employee_id, effective_date, base_salary } = body;

    if (!employee_id || !effective_date || base_salary == null) {
      return NextResponse.json(
        { error: "employee_id, effective_date, and base_salary are required" },
        { status: 400 }
      );
    }
    if (Number(base_salary) <= 0) {
      return NextResponse.json({ error: "base_salary must be positive" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hr_salary")
      .insert({
        employee_id,
        effective_date,
        base_salary: Number(base_salary),
        currency: body.currency || "PHP",
        pay_frequency: body.pay_frequency || "monthly",
        allowances: body.allowances || {},
        deductions: body.deductions || {},
        notes: body.notes || null,
      })
      .select(
        "id, employee_id, effective_date, base_salary, currency, pay_frequency, allowances, deductions, notes, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .single();

    if (error) {
      console.error("Salary insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Salary POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
