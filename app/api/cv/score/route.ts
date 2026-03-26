import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreCandidate } from "@/lib/claude/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { candidateId, jobId } = await request.json();

    if (!candidateId || !jobId) {
      return NextResponse.json({ error: "candidateId and jobId are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch candidate
    const { data: candidate, error: candError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (candError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Score with AI
    const result = await scoreCandidate(
      job.title,
      job.requirements || job.description || "",
      candidate.full_name,
      candidate.experience_years || 0,
      candidate.skills || [],
      candidate.previous_roles || [],
      candidate.education || ""
    );

    // Check if application already exists
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id, status")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .single();

    let application;
    let appError;

    if (existingApp) {
      // Update existing - don't downgrade status if already more advanced
      const advancedStatuses = ["interview_scheduled", "interviewed", "approved"];
      const newStatus = advancedStatuses.includes(existingApp.status) ? existingApp.status : "scored";
      const result2 = await supabase
        .from("applications")
        .update({ ai_score: result.score, ai_reasoning: result.reasoning, status: newStatus })
        .eq("id", existingApp.id)
        .select()
        .single();
      application = result2.data;
      appError = result2.error;
    } else {
      // Insert new
      const result2 = await supabase
        .from("applications")
        .insert({
          candidate_id: candidateId,
          job_id: jobId,
          ai_score: result.score,
          ai_reasoning: result.reasoning,
          status: "scored",
        })
        .select()
        .single();
      application = result2.data;
      appError = result2.error;
    }

    if (appError) {
      console.error("Application error:", appError);
      return NextResponse.json({ error: "Failed to save score" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      candidate_id: candidateId,
      action: "ai_scored",
      details: { job_id: jobId, score: result.score, recommendation: result.recommendation },
    });

    return NextResponse.json({ application, score: result });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json({ error: "Failed to score candidate" }, { status: 500 });
  }
}
