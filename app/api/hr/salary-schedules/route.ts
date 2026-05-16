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
    .from("hr_salary_schedules")
    .select("*")
    .order("scheduled_date", { ascending: true });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.scheduled_date || body.expected_amount === undefined) {
    return NextResponse.json(
      { error: "employee_id, scheduled_date, expected_amount required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_salary_schedules")
    .insert({
      employee_id: body.employee_id,
      scheduled_date: body.scheduled_date,
      expected_amount: body.expected_amount,
      currency: body.currency ?? null,
      reason: body.reason ?? null,
      status: "pending",
      created_by: profile?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}
