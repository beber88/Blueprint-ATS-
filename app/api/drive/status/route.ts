import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();

  // Get sync state
  const { data: syncState } = await supabase
    .from("drive_sync_state")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get file counts by status
  const { data: counts } = await supabase
    .from("drive_files")
    .select("classification_status")
    .then(({ data }) => {
      if (!data) return { data: null };
      const c: Record<string, number> = {};
      for (const row of data) {
        c[row.classification_status] = (c[row.classification_status] || 0) + 1;
      }
      return { data: c };
    });

  // Total files
  const { count: totalFiles } = await supabase
    .from("drive_files")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    sync_state: syncState,
    file_counts: counts || {},
    total_files: totalFiles || 0,
  });
}
