import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPayslipBreakdown } from "@/lib/payroll/compute";

export const dynamic = "force-dynamic";

/**
 * POST /api/payroll/payslips/generate
 * Body: { employee_id, period_start, period_end }
 *
 * Resolves the employee's effective salary (latest hr_salary row with
 * effective_date <= period_end), computes the PH statutory breakdown,
 * and inserts a draft hr_payslips row. Refuses to generate a duplicate
 * payslip for the same employee + period.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    const { employee_id, period_start, period_end } = body;

    if (!employee_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: "employee_id, period_start, and period_end are required" },
        { status: 400 }
      );
    }
    if (period_start > period_end) {
      return NextResponse.json(
        { error: "period_start must be before period_end" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("hr_payslips")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "duplicate", message: "A payslip already exists for this employee and period" },
        { status: 409 }
      );
    }

    const { data: salary, error: salaryErr } = await admin
      .from("hr_salary")
      .select("base_salary, currency, pay_frequency, allowances, deductions")
      .eq("employee_id", employee_id)
      .lte("effective_date", period_end)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (salaryErr) {
      console.error("Salary lookup error:", salaryErr);
      return NextResponse.json({ error: "Failed to resolve salary" }, { status: 500 });
    }
    if (!salary) {
      return NextResponse.json(
        {
          error: "no_salary",
          message: "No effective salary record found for this employee/period",
        },
        { status: 422 }
      );
    }

    const breakdown = buildPayslipBreakdown({
      base_salary: salary.base_salary,
      currency: salary.currency,
      allowances: salary.allowances,
      deductions: salary.deductions,
    });

    const { data: payslip, error: insertErr } = await admin
      .from("hr_payslips")
      .insert({
        employee_id,
        period_start,
        period_end,
        gross_pay: breakdown.gross_pay,
        total_deductions: breakdown.total_deductions,
        net_pay: breakdown.net_pay,
        breakdown,
        status: "draft",
      })
      .select(
        "id, employee_id, period_start, period_end, gross_pay, total_deductions, net_pay, breakdown, status, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .single();

    if (insertErr) {
      console.error("Payslip insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json(payslip, { status: 201 });
  } catch (err) {
    console.error("Payslip generate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
