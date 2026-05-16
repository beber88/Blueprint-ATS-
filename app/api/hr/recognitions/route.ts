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
  const type = url.searchParams.get("type");

  let q = supabase.from("hr_recognitions").select("*").order("date", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recognitions: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.date || !body.type || !body.title) {
    return NextResponse.json(
      { error: "employee_id, date, type, title required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_recognitions")
    .insert({
      employee_id: body.employee_id,
      date: body.date,
      type: body.type,
      title: body.title,
      description: body.description ?? null,
      monetary_amount: body.monetary_amount ?? null,
      currency: body.currency ?? null,
      granted_by: profile?.id ?? null,
      storage_path: body.storage_path ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recognition: data });
}
