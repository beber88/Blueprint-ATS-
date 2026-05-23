import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "employment_type",
  "start_date",
  "end_date",
  "probation_period_days",
  "notice_period_days",
  "working_hours_per_week",
  "working_days",
  "salary_base",
  "currency",
  "terms_text",
  "terms_storage_path",
  "obligations_json",
  "status",
];

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_employment_contracts")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) if (body[k] !== undefined) update[k] = body[k];
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_employment_contracts")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "hr-management", minimumRole: "admin" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("hr_employment_contracts")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
