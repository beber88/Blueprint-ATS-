import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/hr-reports/overview
 *
 * Aggregates a company-wide HR snapshot across the op_/hr_/ct_ tables:
 * headcount, payroll cost, attendance, leave, conduct and contracts.
 * Each section is independent so a failure in one does not blank the
 * whole report.
 */
export async function GET() {
  const admin = createAdminClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const yearStart = `${today.getFullYear()}-01-01`;

  // --- Headcount ---------------------------------------------------------
  const { data: employees } = await admin
    .from("op_employees")
    .select("id, employment_status, is_active, department_id, hire_date")
    .is("merged_into_id", null);

  const active = (employees || []).filter((e) => e.is_active);
  const { data: departments } = await admin
    .from("op_departments")
    .select("id, name");
  const deptName = new Map((departments || []).map((d) => [d.id, d.name]));

  const byDepartment: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  active.forEach((e) => {
    const dn = e.department_id ? deptName.get(e.department_id) || "Unassigned" : "Unassigned";
    byDepartment[dn] = (byDepartment[dn] || 0) + 1;
    const st = e.employment_status || "unknown";
    byStatus[st] = (byStatus[st] || 0) + 1;
  });
  const newHiresThisYear = active.filter(
    (e) => e.hire_date && e.hire_date >= yearStart
  ).length;

  // --- Payroll -----------------------------------------------------------
  const { data: salaries } = await admin
    .from("hr_salary")
    .select("employee_id, base_salary, effective_date, currency")
    .order("effective_date", { ascending: false });

  const latestSalary = new Map<string, { base_salary: number; currency: string }>();
  (salaries || []).forEach((s) => {
    if (!latestSalary.has(s.employee_id)) {
      latestSalary.set(s.employee_id, {
        base_salary: Number(s.base_salary) || 0,
        currency: s.currency || "PHP",
      });
    }
  });
  const monthlyPayrollCost = Array.from(latestSalary.values()).reduce(
    (sum, s) => sum + s.base_salary,
    0
  );

  const { count: payslipsThisMonth } = await admin
    .from("hr_payslips")
    .select("id", { count: "exact", head: true })
    .gte("period_start", monthStart);

  // --- Attendance (current month) ---------------------------------------
  const { data: attendance } = await admin
    .from("hr_attendance")
    .select("status, total_hours, overtime_hours")
    .gte("date", monthStart);

  const attStatus: Record<string, number> = {};
  let totalHours = 0;
  let totalOvertime = 0;
  (attendance || []).forEach((a) => {
    attStatus[a.status] = (attStatus[a.status] || 0) + 1;
    totalHours += Number(a.total_hours) || 0;
    totalOvertime += Number(a.overtime_hours) || 0;
  });

  // --- Leave -------------------------------------------------------------
  const { count: pendingLeave } = await admin
    .from("hr_leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: approvedLeaveThisYear } = await admin
    .from("hr_leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .gte("start_date", yearStart);

  // --- Conduct -----------------------------------------------------------
  const { count: disciplineThisYear } = await admin
    .from("hr_employee_timeline")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "disciplinary_action")
    .gte("event_date", `${yearStart}T00:00:00Z`);
  const { count: recognitionThisYear } = await admin
    .from("hr_employee_timeline")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "recognition")
    .gte("event_date", `${yearStart}T00:00:00Z`);

  // --- Contracts ---------------------------------------------------------
  const { count: activeContracts } = await admin
    .from("ct_contracts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const sixtyDays = new Date(today.getTime() + 60 * 86400000)
    .toISOString()
    .slice(0, 10);
  const { count: expiringContracts } = await admin
    .from("ct_contracts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .lte("expiration_date", sixtyDays);

  const attendanceDays = (attendance || []).length;

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    headcount: {
      active: active.length,
      total: (employees || []).length,
      new_hires_this_year: newHiresThisYear,
      by_department: byDepartment,
      by_status: byStatus,
    },
    payroll: {
      monthly_cost: Math.round(monthlyPayrollCost * 100) / 100,
      employees_with_salary: latestSalary.size,
      payslips_this_month: payslipsThisMonth || 0,
    },
    attendance: {
      records_this_month: attendanceDays,
      by_status: attStatus,
      total_hours: Math.round(totalHours * 100) / 100,
      overtime_hours: Math.round(totalOvertime * 100) / 100,
    },
    leave: {
      pending: pendingLeave || 0,
      approved_this_year: approvedLeaveThisYear || 0,
    },
    conduct: {
      discipline_this_year: disciplineThisYear || 0,
      recognition_this_year: recognitionThisYear || 0,
    },
    contracts: {
      active: activeContracts || 0,
      expiring_soon: expiringContracts || 0,
    },
  });
}
