import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("interviews")
      .update(body)
      .eq("id", id)
      .select(`*, application:applications(candidate_id)`)
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
    }

    // If outcome is set, update candidate status
    if (body.outcome && data.application?.candidate_id) {
      const newStatus = body.outcome === "passed" ? "interviewed" : "rejected";
      await supabase
        .from("candidates")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", data.application.candidate_id);

      await supabase.from("activity_log").insert({
        candidate_id: data.application.candidate_id,
        action: "interview_completed",
        details: { outcome: body.outcome },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
