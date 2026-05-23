import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

/**
 * Unified HR Employees API — single source of truth.
 * Returns enriched employee data with department joins,
 * document counts, and salary info.
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("include_inactive") === "true";
  const departmentId = url.searchParams.get("department_id");
  const search = url.searchParams.get("search");

  const supabase = createAdminClient();

  let query = supabase
    .from("op_employees")
    .select("*, department:op_departments(id, name, name_he, color)")
    .order("full_name");

  if (!includeInactive) query = query.eq("is_active", true);
  if (departmentId) query = query.eq("department_id", departmentId);
  if (search) query = query.ilike("full_name", `%${search}%`);

  const { data: employees, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get document counts per employee
  const { data: docCounts } = await supabase
    .from("hr_employee_documents")
    .select("employee_id");

  const docMap = new Map<string, number>();
  for (const d of docCounts || []) {
    docMap.set(d.employee_id, (docMap.get(d.employee_id) || 0) + 1);
  }

  // Get salary existence per employee
  const { data: salaryData } = await supabase
    .from("hr_salary")
    .select("employee_id, base_salary")
    .order("effective_date", { ascending: false });

  const salaryMap = new Map<string, number>();
  for (const s of salaryData || []) {
    if (!salaryMap.has(s.employee_id)) {
      salaryMap.set(s.employee_id, Number(s.base_salary));
    }
  }

  // Enrich each employee
  const enriched = (employees || []).map((e) => {
    const govIds = (e.government_ids as Record<string, string>) || {};
    const requiredIds = ["sss", "philhealth", "pagibig", "tin"];
    const missingIds = requiredIds.filter((id) => !govIds[id]);

    return {
      ...e,
      doc_count: docMap.get(e.id) || 0,
      current_salary: salaryMap.get(e.id) || null,
      has_salary: salaryMap.has(e.id),
      missing_gov_ids: missingIds,
      compliance_score: Math.round(((requiredIds.length - missingIds.length) / requiredIds.length) * 100),
      data_completeness: calculateCompleteness(e),
    };
  });

  // Get departments for filtering
  const { data: departments } = await supabase
    .from("op_departments")
    .select("id, name, name_he, color")
    .order("name");

  return NextResponse.json({
    employees: enriched,
    departments: departments || [],
    summary: {
      total: enriched.length,
      active: enriched.filter((e) => e.is_active).length,
      with_salary: enriched.filter((e) => e.has_salary).length,
      with_docs: enriched.filter((e) => e.doc_count > 0).length,
      fully_compliant: enriched.filter((e) => e.missing_gov_ids.length === 0).length,
      avg_completeness: enriched.length > 0 ? Math.round(enriched.reduce((s, e) => s + e.data_completeness, 0) / enriched.length) : 0,
    },
  });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.full_name) return NextResponse.json({ error: "full_name required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_employees")
    .insert({
      full_name: String(body.full_name).trim(),
      phone: normalizePhone(body.phone),
      whatsapp_phone: normalizePhone(body.whatsapp_phone || body.phone),
      email: body.email || null,
      role: body.role || null,
      department_id: body.department_id || null,
      project_id: body.project_id || null,
      is_pm: body.is_pm === true,
      is_active: body.is_active !== false,
      role_level: typeof body.role_level === "number" ? body.role_level : 50,
      hire_date: body.hire_date || null,
      date_of_birth: body.date_of_birth || null,
      employment_type: body.employment_type || "full-time",
      address: body.address || null,
      national_id: body.national_id || null,
    })
    .select("*, department:op_departments(id, name, name_he, color)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}

function calculateCompleteness(e: Record<string, unknown>): number {
  const fields = [
    "full_name", "email", "phone", "role", "department_id",
    "hire_date", "date_of_birth", "employment_type",
  ];
  const filled = fields.filter((f) => e[f] != null && e[f] !== "").length;
  const govIds = (e.government_ids as Record<string, string>) || {};
  const govFilled = ["sss", "philhealth", "pagibig", "tin"].filter((id) => govIds[id]).length;
  return Math.round(((filled + govFilled) / (fields.length + 4)) * 100);
}
