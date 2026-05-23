import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

interface Issue {
  field: string;
  severity: "high" | "medium" | "low";
}

/**
 * GET /api/hr/qc/data-quality
 *
 * Scans active employees for missing or incomplete data and returns
 * a per-employee issue list plus aggregate counts. Severity reflects
 * how much the gap blocks downstream HR processes (payroll, statutory
 * filing, leave accruals, etc.).
 */
export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data: employees, error } = await supabase
    .from("op_employees")
    .select(
      "id, full_name, email, phone, position, department_id, hire_date, date_of_birth, national_id, government_ids, employment_status, employee_code"
    )
    .is("merged_into_id", null)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: salaries } = await supabase.from("hr_salary").select("employee_id");
  const hasSalary = new Set((salaries || []).map((s) => s.employee_id));

  const results = (employees || [])
    .map((e) => {
      const issues: Issue[] = [];
      const gov = (e.government_ids as Record<string, string>) || {};

      if (!e.full_name || e.full_name.trim().length < 2)
        issues.push({ field: "full_name", severity: "high" });
      if (!e.department_id) issues.push({ field: "department", severity: "medium" });
      if (!e.position) issues.push({ field: "position", severity: "medium" });
      if (!e.hire_date) issues.push({ field: "hire_date", severity: "high" });
      if (!hasSalary.has(e.id)) issues.push({ field: "salary", severity: "high" });
      if (!e.phone && !e.email) issues.push({ field: "contact", severity: "medium" });
      if (!e.date_of_birth) issues.push({ field: "date_of_birth", severity: "low" });
      if (!e.employee_code) issues.push({ field: "employee_code", severity: "low" });
      if (!gov.sss_no || !gov.philhealth_no || !gov.pagibig_no || !gov.tin)
        issues.push({ field: "government_ids", severity: "high" });

      return {
        id: e.id,
        full_name: e.full_name,
        issues,
        score: issues.length,
      };
    })
    .filter((r) => r.issues.length > 0)
    .sort((a, b) => b.score - a.score);

  const bySeverity = { high: 0, medium: 0, low: 0 };
  results.forEach((r) =>
    r.issues.forEach((i) => {
      bySeverity[i.severity]++;
    })
  );

  return NextResponse.json({
    scanned: (employees || []).length,
    clean: (employees || []).length - results.length,
    flagged: results.length,
    by_severity: bySeverity,
    employees: results,
  });
}
