import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { applySalarySchedule, cancelSalarySchedule } from "@/lib/hr/salary";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_salary_schedules")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

// PATCH with { action: 'apply' | 'cancel' } triggers the side-effecting
// helpers. Other PATCH bodies edit free fields (scheduled_date,
// expected_amount, currency, reason) while still pending.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError, profile } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  if (body.action === "apply") {
    try {
      const result = await applySalarySchedule(supabase, params.id, profile?.id ?? null);
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "apply failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
  if (body.action === "cancel") {
    try {
      await cancelSalarySchedule(supabase, params.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cancel failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = {};
  for (const k of ["scheduled_date", "expected_amount", "currency", "reason"]) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hr_salary_schedules")
    .update(update)
    .eq("id", params.id)
    .eq("status", "pending")
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "hr-management", minimumRole: "admin" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { error } = await supabase.from("hr_salary_schedules").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
