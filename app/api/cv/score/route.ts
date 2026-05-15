import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeCV } from "@/lib/claude/client";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("CV Score: Missing ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const { candidateId, jobId } = await request.json();

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: candidate, error: candError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (candError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Job is optional — analyze CV even without a specific job
    let job: Record<string, unknown> | null = null;
    if (jobId) {
      const { data: jobData } = await supabase.from("jobs").select("*").eq("id", jobId).single();
      job = jobData;
    }

    // Run comprehensive AI analysis
    const cvText = candidate.cv_raw_text || [
      `Name: ${candidate.full_name}`,
      `Experience: ${candidate.experience_years || 0} years`,
      `Skills: ${(candidate.skills || []).join(", ")}`,
      `Education: ${candidate.education || "N/A"}`,
      `Previous Roles: ${JSON.stringify(candidate.previous_roles || [])}`,
    ].join("\n");

    const analysis = await analyzeCV(cvText, (job as Record<string, string>)?.title || undefined);
    const totalScore = (analysis.total_score as number) || 0;
    const verdict = analysis.verdict as Record<string, unknown> | undefined;

    // Save analysis to candidate
    await supabase.from("candidates").update({
      ai_analysis: analysis,
      overall_ai_score: totalScore || null,
    }).eq("id", candidateId);

    // Only create/update application if jobId provided
    let application = null;
    let appError = null;

    if (jobId) {
      const { data: existingApp } = await supabase
        .from("applications")
        .select("id, status")
        .eq("candidate_id", candidateId)
        .eq("job_id", jobId)
        .single();

      if (existingApp) {
        const advancedStatuses = ["interview_scheduled", "interviewed", "approved"];
        const newStatus = advancedStatuses.includes(existingApp.status) ? existingApp.status : "scored";
        const r = await supabase.from("applications").update({
          ai_score: totalScore, ai_reasoning: (verdict?.summary as string) || "", status: newStatus,
        }).eq("id", existingApp.id).select().single();
        application = r.data; appError = r.error;
      } else {
        const r = await supabase.from("applications").insert({
          candidate_id: candidateId, job_id: jobId,
          ai_score: totalScore, ai_reasoning: (verdict?.summary as string) || "", status: "scored",
        }).select().single();
        application = r.data; appError = r.error;
      }

      if (appError) {
        console.error("Application error:", appError);
      }
    }

    await supabase.from("activity_log").insert({
      candidate_id: candidateId,
      action: "ai_scored",
      details: { job_id: jobId || null, score: totalScore, recommendation: verdict?.recommendation },
    });

    return NextResponse.json({ application, analysis });
  } catch (error) {
    console.error("CV Score: Unhandled error", { error: error instanceof Error ? error.message : error, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to score candidate" }, { status: 500 });
  }
}
