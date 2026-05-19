import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { computePayslip, type PayrollInput } from "@/lib/payroll/compute";

export const dynamic = "force-dynamic";

/**
 * POST /api/hr/payroll/finalize
 * Body: { period_start, period_end, is_semi_monthly? }
 *
 * Computes payslips and PERSISTS them to hr_payslips.
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

  // Check for existing payslips in this period
  const { count } = await supabase
    .from("hr_payslips")
    .select("id", { count: "exact", head: true })
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  if (count && count > 0) {
    return NextResponse.json({ error: "Payslips already exist for this period", count }, { status: 409 });
  }

  // Get employees + salaries
  const { data: employees } = await supabase
    .from("op_employees")
    .select("id, full_name")
    .eq("is_active", true);

  const { data: salaries } = await supabase
    .from("hr_salary")
    .select("employee_id, base_salary, allowances")
    .order("effective_date", { ascending: false });

  const salaryMap = new Map<string, { base_salary: number; allowances: Record<string, number> | null }>();
  for (const s of salaries || []) {
    if (!salaryMap.has(s.employee_id)) {
      salaryMap.set(s.employee_id, { base_salary: Number(s.base_salary), allowances: s.allowances as Record<string, number> | null });
    }
  }

  const rows = [];
  for (const emp of employees || []) {
    const sal = salaryMap.get(emp.id);
    if (!sal || sal.base_salary <= 0) continue;

    const input: PayrollInput = {
      baseSalary: sal.base_salary,
      allowances: sal.allowances || {},
      isSemiMonthly: body.is_semi_monthly !== false,
    };

    const breakdown = computePayslip(input);

    rows.push({
      employee_id: emp.id,
      period_start: periodStart,
      period_end: periodEnd,
      gross_pay: breakdown.gross_pay,
      total_deductions: breakdown.total_deductions,
      net_pay: breakdown.net_pay,
      breakdown: breakdown as unknown as Record<string, unknown>,
      status: "final",
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No employees with salary records" }, { status: 400 });
  }

  const { error } = await supabase.from("hr_payslips").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    created: rows.length,
    period_start: periodStart,
    period_end: periodEnd,
    total_net: rows.reduce((s, r) => s + (r.net_pay || 0), 0),
  });
}
