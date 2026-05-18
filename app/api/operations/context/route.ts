import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const active = url.searchParams.get("active");
  const projectId = url.searchParams.get("project_id");

  let query = supabase
    .from("op_context_entries")
    .select("*")
    .order("usage_count", { ascending: false });

  if (type) query = query.eq("entry_type", type);
  if (active === "true") query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);
  if (projectId) query = query.eq("scope_project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.trigger_text || !body.resolution) {
    return NextResponse.json({ error: "trigger_text and resolution required" }, { status: 400 });
  }

  const validTypes = ["abbreviation", "entity_mapping", "project_phase", "pattern", "general"];
  const entryType = validTypes.includes(body.entry_type) ? body.entry_type : "general";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_context_entries")
    .insert({
      entry_type: entryType,
      trigger_text: String(body.trigger_text).trim(),
      resolution: String(body.resolution).trim(),
      resolution_he: body.resolution_he ? String(body.resolution_he).trim() : null,
      scope_project_id: body.scope_project_id || null,
      scope_department_id: body.scope_department_id || null,
      confidence: 1.0,
      source: "admin_explanation",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
