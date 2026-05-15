import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const FIELDS = ["full_name", "phone", "whatsapp_phone", "email", "role", "department_id", "project_id", "is_pm", "is_active"] as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) {
    if (f in body) {
      if (f === "phone" || f === "whatsapp_phone") update[f] = normalizePhone(body[f]);
      else update[f] = body[f];
    }
  }
  const { data, error } = await supabase.from("op_employees").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  // Soft delete — flip is_active so historical FK references stay intact
  const { error } = await supabase.from("op_employees").update({ is_active: false }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
