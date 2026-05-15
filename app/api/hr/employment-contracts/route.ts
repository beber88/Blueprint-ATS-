import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employee_id");
  const status = url.searchParams.get("status");

  let q = supabase
    .from("hr_employment_contracts")
    .select("*")
    .order("start_date", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.employment_type || !body.start_date) {
    return NextResponse.json(
      { error: "employee_id, employment_type, start_date required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_employment_contracts")
    .insert({
      employee_id: body.employee_id,
      employment_type: body.employment_type,
      start_date: body.start_date,
      end_date: body.end_date ?? null,
      probation_period_days: body.probation_period_days ?? null,
      notice_period_days: body.notice_period_days ?? null,
      working_hours_per_week: body.working_hours_per_week ?? null,
      working_days: body.working_days ?? null,
      salary_base: body.salary_base ?? null,
      currency: body.currency ?? null,
      terms_text: body.terms_text ?? null,
      terms_storage_path: body.terms_storage_path ?? null,
      obligations_json: body.obligations_json ?? [],
      status: body.status ?? "active",
      created_by: profile?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}
