import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select(`
        *,
        applications(*, job:jobs(*)),
        activity_log(*)
      `)
      .eq("id", id)
      .single();

    if (error || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Fetch interviews for this candidate's applications
    const applicationIds = (candidate.applications || []).map((a: { id: string }) => a.id);
    let interviews: unknown[] = [];
    if (applicationIds.length > 0) {
      const { data: interviewData } = await supabase
        .from("interviews")
        .select("*")
        .in("application_id", applicationIds)
        .order("scheduled_at", { ascending: false });
      interviews = interviewData || [];
    }

    // Fetch sent messages
    const { data: messages } = await supabase
      .from("messages_sent")
      .select("*, template:message_templates(*)")
      .eq("candidate_id", id)
      .order("sent_at", { ascending: false });

    return NextResponse.json({ ...candidate, interviews, messages: messages || [] });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const updateData: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from("candidates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
    }

    // Log status change
    if (body.status) {
      await supabase.from("activity_log").insert({
        candidate_id: id,
        action: "status_changed",
        details: { new_status: body.status },
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

    const { id: candidateId } = await params;
    const supabase = createAdminClient();

    // Delete from candidate_files
    const { data: files } = await supabase
      .from("candidate_files")
      .select("file_url")
      .eq("candidate_id", candidateId);

    // Delete storage files
    if (files && files.length > 0) {
      const paths = files.map((f: { file_url: string }) => {
        try {
          const url = new URL(f.file_url);
          const match = url.pathname.match(/\/storage\/v1\/object\/public\/cvs\/(.*)/);
          return match ? match[1] : null;
        } catch { return null; }
      }).filter(Boolean) as string[];
      if (paths.length > 0) await supabase.storage.from("cvs").remove(paths);
    }

    // Delete related records
    await supabase.from("candidate_files").delete().eq("candidate_id", candidateId);
    await supabase.from("applications").delete().eq("candidate_id", candidateId);
    await supabase.from("activity_log").delete().eq("candidate_id", candidateId);
    await supabase.from("messages_sent").delete().eq("candidate_id", candidateId);
    await supabase.from("status_changes").delete().eq("candidate_id", candidateId);

    // Delete candidate
    const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete candidate error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
