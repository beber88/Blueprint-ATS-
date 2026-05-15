import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const [{ data: report }, { data: items }] = await Promise.all([
    supabase
      .from("op_reports")
      .select("*, employee:op_employees(full_name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("op_report_items")
      .select(
        "*, department:op_departments(name, name_he, color), project:op_projects(name), employee:op_employees(full_name)"
      )
      .eq("report_id", params.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report, items: items || [] });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { error } = await supabase.from("op_reports").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
