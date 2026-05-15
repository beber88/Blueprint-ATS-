import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ permission: "view_salary" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();
  const employee_id = url.searchParams.get("employee_id");

  let query = supabase
    .from("hr_salary")
    .select("*, employee:hr_employees(id, full_name)")
    .order("effective_date", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salary_records: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ permission: "view_salary" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.base_salary)
    return NextResponse.json({ error: "employee_id, base_salary required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_salary")
    .insert({
      employee_id: body.employee_id,
      base_salary: body.base_salary,
      currency: body.currency || "PHP",
      effective_date: body.effective_date || new Date().toISOString().split("T")[0],
      allowances: body.allowances || null,
      deductions: body.deductions || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salary: data });
}
