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
  if (body.classification_status) updates.classification_status = body.classification_status;
  if (body.target_table) updates.target_table = body.target_table;
  if (body.document_type) updates.document_type = body.document_type;
  if (body.target_employee_id !== undefined) updates.target_employee_id = body.target_employee_id || null;

  const { data, error } = await supabase
    .from("drive_files")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ file: data });
}
