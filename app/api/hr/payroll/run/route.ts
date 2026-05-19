import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { computePayslip, type PayrollInput } from "@/lib/payroll/compute";

export const dynamic = "force-dynamic";

/**
 * POST /api/hr/payroll/run
 * Body: { period_start, period_end, is_semi_monthly? }
 *
 * Computes payslips for all active employees with salary records.
 * Returns preview data. Does NOT persist until /finalize is called.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const periodStart = body.period_start;
  const periodEnd = body.period_end;
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "period_start and period_end required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get all active employees with their latest salary
  const { data: employees } = await supabase
    .from("op_employees")
    .select("id, full_name, department_id, role")
    .eq("is_active", true)
    .order("full_name");

  if (!employees || employees.length === 0) {
    return NextResponse.json({ error: "No active employees" }, { status: 404 });
  }

  // Get salary records for each employee (latest per employee)
  const { data: salaries } = await supabase
    .from("hr_salary")
    .select("employee_id, base_salary, currency, pay_frequency, allowances, deductions")
    .order("effective_date", { ascending: false });

  const salaryMap = new Map<string, typeof salaries extends (infer T)[] | null ? T : never>();
  for (const s of salaries || []) {
    if (!salaryMap.has(s.employee_id)) {
      salaryMap.set(s.employee_id, s);
    }
  }

  // Compute payslip for each employee
  const payslips = employees.map((emp) => {
    const sal = salaryMap.get(emp.id);
    const baseSalary = sal ? Number(sal.base_salary) : 0;

    if (baseSalary <= 0) {
      return {
        employee_id: emp.id,
        employee_name: emp.full_name,
        role: emp.role,
        has_salary: false,
        breakdown: null,
      };
    }

    const allowances = (sal?.allowances as Record<string, number>) || {};

    const input: PayrollInput = {
      baseSalary: baseSalary,
      allowances,
      isSemiMonthly: body.is_semi_monthly !== false,
    };

    const breakdown = computePayslip(input);

    return {
      employee_id: emp.id,
      employee_name: emp.full_name,
      role: emp.role,
      has_salary: true,
      base_salary: baseSalary,
      breakdown,
    };
  });

  return NextResponse.json({
    period_start: periodStart,
    period_end: periodEnd,
    payslips,
    total_employees: employees.length,
    with_salary: payslips.filter((p) => p.has_salary).length,
    total_gross: payslips.reduce((s, p) => s + (p.breakdown?.gross_pay || 0), 0),
    total_net: payslips.reduce((s, p) => s + (p.breakdown?.net_pay || 0), 0),
  });
}