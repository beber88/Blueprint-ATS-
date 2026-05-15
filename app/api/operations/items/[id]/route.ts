import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const UPDATABLE = new Set([
  "status",
  "priority",
  "deadline",
  "person_responsible_id",
  "department_id",
  "project_id",
  "missing_information",
  "ceo_decision_needed",
  "next_action",
  "category",
  "issue",
]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) update[k] = v;
  }

  if (body.status === "resolved" && !body.resolved_at) {
    update.resolved_at = new Date().toISOString();
  }
  if (body.status && body.status !== "resolved") {
    update.resolved_at = null;
  }

  // Append a history entry on status changes
  if (body.status) {
    const { data: current } = await supabase
      .from("op_report_items")
      .select("status, history")
      .eq("id", params.id)
      .single();
    if (current && current.status !== body.status) {
      const history = Array.isArray(current.history) ? current.history : [];
      history.push({
        from: current.status,
        to: body.status,
        at: new Date().toISOString(),
        by: body.actor || "system",
      });
      update.history = history;
    }
  }

  const { data, error } = await supabase
    .from("op_report_items")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { error } = await supabase.from("op_report_items").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
