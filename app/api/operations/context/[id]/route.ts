import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.trigger_text === "string") updates.trigger_text = body.trigger_text.trim();
  if (typeof body.resolution === "string") updates.resolution = body.resolution.trim();
  if (typeof body.resolution_he === "string") updates.resolution_he = body.resolution_he.trim();
  if (typeof body.entry_type === "string") updates.entry_type = body.entry_type;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (body.scope_project_id !== undefined) updates.scope_project_id = body.scope_project_id || null;
  if (body.scope_department_id !== undefined) updates.scope_department_id = body.scope_department_id || null;

  const { data, error } = await supabase
    .from("op_context_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("op_context_entries")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
