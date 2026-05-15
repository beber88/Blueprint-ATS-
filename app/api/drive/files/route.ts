import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const syncStateId = searchParams.get("syncStateId");
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100")));

  let query = admin
    .from("drive_files")
    .select(
      "id, drive_file_id, name, mime_type, size_bytes, modified_time, classification_status, classification, document_type, target_table, target_id, target_employee_id, original_language, error_log, imported_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("classification_status", status);
  if (syncStateId) query = query.eq("sync_state_id", syncStateId);

  const { data, error } = await query;
  if (error) {
    console.error("drive files query error:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ files: data || [] });
}
