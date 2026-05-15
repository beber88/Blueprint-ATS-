import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Filterable list of report items. Used by every dashboard page.
//
// Query params:
//   status, priority, category, project_id, department_id
//   ceo_decision_needed=true
//   has_missing_info=true
//   overdue=true   (deadline < today AND status != resolved)
//   search=<text>
//   limit, offset
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("op_report_items")
    .select(
      "*, department:op_departments(id, name, name_he, color), project:op_projects(id, name), employee:op_employees(id, full_name), report:op_reports(id, report_date, source_type)",
      { count: "exact" }
    )
    .order("priority", { ascending: false })
    .order("report_date", { ascending: false })
    .range(offset, offset + limit - 1);

  const status = url.searchParams.get("status");
  if (status) query = query.eq("status", status);

  const priority = url.searchParams.get("priority");
  if (priority) query = query.eq("priority", priority);

  const category = url.searchParams.get("category");
  if (category) {
    if (category.includes(",")) {
      query = query.in("category", category.split(","));
    } else {
      query = query.eq("category", category);
    }
  }

  const projectId = url.searchParams.get("project_id");
  if (projectId) query = query.eq("project_id", projectId);

  const deptId = url.searchParams.get("department_id");
  if (deptId) query = query.eq("department_id", deptId);

  if (url.searchParams.get("ceo_decision_needed") === "true") {
    query = query.eq("ceo_decision_needed", true);
  }

  if (url.searchParams.get("has_missing_info") === "true") {
    query = query.not("missing_information", "is", null);
  }

  if (url.searchParams.get("overdue") === "true") {
    query = query.lt("deadline", today).neq("status", "resolved");
  }

  if (url.searchParams.get("open_only") === "true") {
    query = query.neq("status", "resolved");
  }

  const search = url.searchParams.get("search");
  if (search && search.trim()) {
    const s = search.trim().replace(/[%]/g, "");
    query = query.or(
      `issue.ilike.%${s}%,next_action.ilike.%${s}%,missing_information.ilike.%${s}%,person_responsible_raw.ilike.%${s}%,project_raw.ilike.%${s}%,department_raw.ilike.%${s}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [], count: count || 0 });
}
