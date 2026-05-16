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
  const recordType = url.searchParams.get("record_type");

  let q = supabase
    .from("hr_compliance_records")
    .select("*")
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (status) q = q.eq("status", status);
  if (recordType) q = q.eq("record_type", recordType);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.record_type) {
    return NextResponse.json({ error: "employee_id, record_type required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_compliance_records")
    .insert({
      employee_id: body.employee_id,
      record_type: body.record_type,
      identifier_number: body.identifier_number ?? null,
      issue_date: body.issue_date ?? null,
      expiry_date: body.expiry_date ?? null,
      status: body.status ?? "valid",
      storage_path: body.storage_path ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}
