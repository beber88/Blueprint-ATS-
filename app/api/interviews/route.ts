import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("interviews")
      .select(`
        *,
        application:applications(
          *,
          candidate:candidates(id, full_name, email, phone, status),
          job:jobs(id, title)
        )
      `)
      .order("scheduled_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch interviews" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();
    const body = await request.json();

    // If candidateId and jobId provided instead of applicationId, find or create application
    let applicationId = body.application_id;
    if (!applicationId && body.candidate_id && body.job_id) {
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("candidate_id", body.candidate_id)
        .eq("job_id", body.job_id)
        .single();

      if (existing) {
        applicationId = existing.id;
      } else {
        const { data: newApp, error: appError } = await supabase
          .from("applications")
          .insert({ candidate_id: body.candidate_id, job_id: body.job_id, status: "interview_scheduled" })
          .select()
          .single();
        if (appError || !newApp) {
          return NextResponse.json({ error: "Failed to create application for interview" }, { status: 500 });
        }
        applicationId = newApp.id;
      }
    }

    if (!applicationId) {
      return NextResponse.json({ error: "application_id, or candidate_id and job_id are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("interviews")
      .insert({
        application_id: applicationId,
        scheduled_at: body.scheduled_at,
        duration_minutes: body.duration_minutes || 60,
        interviewer: body.interviewer || null,
        type: body.type || "in-person",
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Failed to schedule interview" }, { status: 500 });
    }

    // Update candidate status
    if (body.candidate_id) {
      await supabase
        .from("candidates")
        .update({ status: "interview_scheduled", updated_at: new Date().toISOString() })
        .eq("id", body.candidate_id);

      await supabase.from("activity_log").insert({
        candidate_id: body.candidate_id,
        action: "interview_scheduled",
        details: { scheduled_at: body.scheduled_at, type: body.type },
      });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
