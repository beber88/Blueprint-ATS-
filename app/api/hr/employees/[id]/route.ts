import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const ALL_FIELDS = [
  "full_name", "phone", "whatsapp_phone", "email", "role",
  "department_id", "project_id", "is_pm", "is_active", "role_level",
  "hire_date", "date_of_birth", "employment_type", "manager_id",
  "address", "national_id", "salary_grade", "gender",
  "government_ids", "emergency_contact",
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: employee, error } = await supabase
    .from("op_employees")
    .select("*, department:op_departments(id, name, name_he, color)")
    .eq("id", id)
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Get related data
  const [docs, salary, leaves, reviews, assets] = await Promise.all([
    supabase.from("hr_employee_documents").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
    supabase.from("hr_salary").select("*").eq("employee_id", id).order("effective_date", { ascending: false }),
    supabase.from("hr_leave_requests").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
    supabase.from("hr_performance_reviews").select("*").eq("employee_id", id).order("review_date", { ascending: false }),
    supabase.from("hr_asset_assignments").select("*, asset:hr_assets(*)").eq("employee_id", id),
  ]);

  return NextResponse.json({
    employee,
    documents: docs.data || [],
    salary_records: salary.data || [],
    leave_requests: leaves.data || [],
    performance_reviews: reviews.data || [],
    assets: assets.data || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of ALL_FIELDS) {
    if (f in body) {
      if (f === "phone" || f === "whatsapp_phone") {
        update[f] = normalizePhone(body[f]);
      } else {
        update[f] = body[f];
      }
    }
  }

  const { data, error } = await supabase
    .from("op_employees")
    .update(update)
    .eq("id", id)
    .select("*, department:op_departments(id, name, name_he, color)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}
