import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeDriveFile } from "@/lib/drive/router";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/drive/files/[id]
 * Manually fix a drive_file's classification then optionally re-route it.
 * Body: { document_type?, target_employee_id?, target_table_hint?, route?: boolean, action?: "route" | "skip" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const admin = createAdminClient();

  if (body.action === "skip") {
    await admin
      .from("drive_files")
      .update({
        classification_status: "skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ ok: true, action: "skipped" });
  }

  const { data: existing } = await admin
    .from("drive_files")
    .select("classification")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const newClassification = {
    ...((existing?.classification as Record<string, unknown>) || {}),
    ...(body.document_type ? { document_type: body.document_type } : {}),
    ...(body.target_table_hint ? { target_table_hint: body.target_table_hint } : {}),
    ...(body.employee_name ? { employee_name: body.employee_name } : {}),
    confidence: 100,
  };
  updates.classification = newClassification;
  if (body.document_type) updates.document_type = body.document_type;
  if (body.target_employee_id !== undefined) updates.target_employee_id = body.target_employee_id;
  if (body.target_table_hint) updates.target_table = body.target_table_hint;
  updates.classification_status = "classified";
  updates.error_log = [];

  const { error } = await admin.from("drive_files").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.action === "route" || body.route === true) {
    const result = await routeDriveFile(id);
    return NextResponse.json({ ok: true, route_result: result });
  }

  return NextResponse.json({ ok: true });
}
