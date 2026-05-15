import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();

  // Get the item with all relations including the full report
  const { data: item, error } = await supabase
    .from("op_report_items")
    .select("*, department:op_departments(id, name, name_he, color), project:op_projects(id, name), employee:op_employees(id, full_name, role), report:op_reports(id, raw_text, source_type, source_meta, report_date, processing_status, processed_at, storage_path, created_at)")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !item) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }

  // Get sibling items from same report
  let siblings: unknown[] = [];
  if (item.report_id) {
    const { data } = await supabase
      .from("op_report_items")
      .select("id, issue, status, priority, category")
      .eq("report_id", item.report_id)
      .neq("id", params.id)
      .order("created_at");
    siblings = data || [];
  }

  return NextResponse.json({ item, siblings });
}
