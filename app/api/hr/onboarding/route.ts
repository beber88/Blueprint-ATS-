import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();
  const employee_id = url.searchParams.get("employee_id");
  const status = url.searchParams.get("status");

  let query = supabase
    .from("hr_onboarding_tasks")
    .select("*, employee:hr_employees(id, full_name)")
    .order("due_date", { ascending: true });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.title)
    return NextResponse.json({ error: "employee_id, title required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_onboarding_tasks")
    .insert({
      employee_id: body.employee_id,
      title: body.title,
      description: body.description || null,
      assigned_to: body.assigned_to || null,
      due_date: body.due_date || null,
      status: body.status || "pending",
      template_id: body.template_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
