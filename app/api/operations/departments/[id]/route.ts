import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const FIELDS = ["name", "name_he", "name_en", "name_tl", "color"] as const;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: dept }, { data: items }] = await Promise.all([
    supabase.from("op_departments").select("*").eq("id", params.id).single(),
    supabase
      .from("op_report_items")
      .select("*, project:op_projects(name), employee:op_employees(full_name)")
      .eq("department_id", params.id)
      .order("priority", { ascending: false })
      .order("report_date", { ascending: false })
      .limit(200),
  ]);
  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ department: dept, items: items || [] });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) update[f] = body[f];
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("op_departments").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ department: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("op_departments").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
