import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const FIELDS = ["name", "code", "status", "department_id", "started_at", "notes"] as const;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: project }, { data: items }] = await Promise.all([
    supabase
      .from("op_projects")
      .select("*, department:op_departments(id, name, name_he, color)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("op_report_items")
      .select("*, department:op_departments(name, name_he), employee:op_employees(full_name)")
      .eq("project_id", params.id)
      .order("priority", { ascending: false })
      .order("report_date", { ascending: false })
      .limit(200),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project, items: items || [] });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (f in body) update[f] = body[f];
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("op_projects").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("op_projects").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
