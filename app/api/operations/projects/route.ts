import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_projects")
    .select("*, department:op_departments(name, name_he, color)")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const body = await request.json().catch(() => ({}));
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_projects")
    .insert({
      name: String(body.name).trim(),
      code: body.code || null,
      status: body.status || "active",
      department_id: body.department_id || null,
      started_at: body.started_at || null,
      notes: body.notes || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
