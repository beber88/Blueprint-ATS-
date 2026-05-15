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
  const asset_id = url.searchParams.get("asset_id");

  let query = supabase
    .from("hr_asset_assignments")
    .select("*, employee:hr_employees(id, full_name), asset:hr_assets(id, name, serial_number)")
    .order("assigned_at", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (asset_id) query = query.eq("asset_id", asset_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.asset_id)
    return NextResponse.json({ error: "employee_id, asset_id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_asset_assignments")
    .insert({
      employee_id: body.employee_id,
      asset_id: body.asset_id,
      assigned_at: new Date().toISOString(),
      condition_on_assign: body.condition_on_assign || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
