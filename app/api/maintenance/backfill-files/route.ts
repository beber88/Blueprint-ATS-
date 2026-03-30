import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Find candidates with cv_file_url but no candidate_files record
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, full_name, cv_file_url")
      .not("cv_file_url", "is", null);

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ backfilled: 0, message: "No candidates to backfill" });
    }

    let backfilled = 0;
    for (const c of candidates) {
      // Check if already has a candidate_files record
      const { data: existing } = await supabase
        .from("candidate_files")
        .select("id")
        .eq("candidate_id", c.id)
        .eq("file_type", "cv")
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("candidate_files").insert({
          candidate_id: c.id,
          file_name: `${c.full_name}_CV.pdf`,
          file_type: "cv",
          file_url: c.cv_file_url,
          ai_classification_confidence: 1.0,
          ai_classification_reasoning: "Backfilled from existing CV upload",
          metadata: { backfilled: true },
        });
        backfilled++;
      }
    }

    return NextResponse.json({ backfilled, total: candidates.length });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
