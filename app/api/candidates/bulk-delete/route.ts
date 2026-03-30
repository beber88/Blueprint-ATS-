import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { candidate_ids } = await request.json();
    if (!candidate_ids || !Array.isArray(candidate_ids)) {
      return NextResponse.json({ error: "candidate_ids array required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    let deleted = 0;
    let failed = 0;

    for (const id of candidate_ids) {
      try {
        await supabase.from("candidate_files").delete().eq("candidate_id", id);
        await supabase.from("applications").delete().eq("candidate_id", id);
        await supabase.from("activity_log").delete().eq("candidate_id", id);
        await supabase.from("messages_sent").delete().eq("candidate_id", id);
        await supabase.from("status_changes").delete().eq("candidate_id", id);
        const { error } = await supabase.from("candidates").delete().eq("id", id);
        if (error) throw error;
        deleted++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ deleted, failed, total: candidate_ids.length });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
