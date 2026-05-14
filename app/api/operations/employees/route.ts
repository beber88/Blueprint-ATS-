import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createAdminClient();
  const includeInactive = url.searchParams.get("include_inactive") === "true";

  let query = supabase
    .from("op_employees")
    .select("*, department:op_departments(name, name_he), project:op_projects(name)")
    .order("full_name");
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.full_name) return NextResponse.json({ error: "full_name required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_employees")
    .insert({
      full_name: String(body.full_name).trim(),
      phone: normalizePhone(body.phone),
      whatsapp_phone: normalizePhone(body.whatsapp_phone || body.phone),
      email: body.email || null,
      role: body.role || null,
      department_id: body.department_id || null,
      project_id: body.project_id || null,
      is_pm: body.is_pm === true,
      is_active: body.is_active !== false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}
