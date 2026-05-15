import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

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
      const outcomeStatusMap: Record<string, string> = {
        passed: "interviewed",
        failed: "rejected",
        cancelled: "shortlisted",
      };
      const newStatus = outcomeStatusMap[body.outcome] || "interviewed";
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const { id } = await params;
    const supabase = createAdminClient();
    const { error } = await supabase.from("interviews").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
