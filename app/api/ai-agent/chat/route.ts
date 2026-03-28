import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const { message, conversationHistory } = await request.json();
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch all system data in parallel
    const [
      { data: candidates },
      { data: jobs },
      { data: applications },
      { data: interviews },
      { data: recentActivity },
      { data: templates },
      { data: messagesSent },
    ] = await Promise.all([
      supabase.from("candidates").select("id, full_name, email, phone, location, skills, experience_years, education, status, contact_status, ai_analysis, created_at, job_id").order("created_at", { ascending: false }).limit(100),
      supabase.from("jobs").select("id, title, department, location, employment_type, status, description, requirements, created_at").order("created_at", { ascending: false }),
      supabase.from("applications").select("id, candidate_id, job_id, ai_score, ai_reasoning, status, applied_at").order("applied_at", { ascending: false }).limit(200),
      supabase.from("interviews").select("id, application_id, scheduled_at, duration_minutes, type, interviewer, outcome, notes").order("scheduled_at", { ascending: false }).limit(50),
      supabase.from("activity_log").select("id, candidate_id, action, details, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("message_templates").select("id, name, type, category").limit(50),
      supabase.from("messages_sent").select("id, candidate_id, channel, status, created_at").order("created_at", { ascending: false }).limit(50),
    ]);

    // Build summary stats
    const totalCandidates = candidates?.length || 0;
    const totalJobs = jobs?.length || 0;
    const activeJobs = jobs?.filter(j => j.status === "active").length || 0;
    const totalApplications = applications?.length || 0;
    const scoredApps = (applications || []).filter(a => a.ai_score);
    const avgScore = scoredApps.length > 0 ? scoredApps.reduce((sum, a) => sum + (a.ai_score || 0), 0) / scoredApps.length : 0;
    const statusBreakdown: Record<string, number> = {};
    candidates?.forEach(c => { statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1; });

    const candidateSummaries = (candidates || []).map(c => {
      const apps = (applications || []).filter(a => a.candidate_id === c.id);
      const job = c.job_id ? jobs?.find(j => j.id === c.job_id) : null;
      return `- ${c.full_name} | ${c.email || "N/A"} | Status: ${c.status} | Experience: ${c.experience_years || 0}y | Skills: ${(c.skills || []).slice(0, 5).join(", ")} | Contact: ${c.contact_status || "none"} | Job: ${job?.title || "unassigned"} | AI Scores: ${apps.map(a => a.ai_score || "N/A").join(", ")} | Added: ${c.created_at?.split("T")[0]}`;
    }).join("\n");

    const jobSummaries = (jobs || []).map(j => {
      const jobApps = (applications || []).filter(a => a.job_id === j.id);
      const scores = jobApps.map(a => a.ai_score).filter(Boolean) as number[];
      return `- ${j.title} | ${j.department || "N/A"} | ${j.location || "N/A"} | Status: ${j.status} | Type: ${j.employment_type} | Candidates: ${jobApps.length} | Avg Score: ${scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : "N/A"} | Top Score: ${scores.length ? Math.max(...scores) : "N/A"}`;
    }).join("\n");

    const interviewSummaries = (interviews || []).slice(0, 20).map(i => {
      const app = applications?.find(a => a.id === i.application_id);
      const cand = app ? candidates?.find(c => c.id === app.candidate_id) : null;
      return `- ${cand?.full_name || "Unknown"} | ${i.scheduled_at?.split("T")[0]} ${i.scheduled_at?.split("T")[1]?.slice(0,5) || ""} | Type: ${i.type} | Duration: ${i.duration_minutes}min | Interviewer: ${i.interviewer || "N/A"} | Outcome: ${i.outcome || "pending"}`;
    }).join("\n");

    const systemPrompt = `You are the Blueprint ATS AI Assistant - an intelligent HR advisor embedded in an Applicant Tracking System.
You have full access to all system data and can provide insights, recommendations, and analysis.

SYSTEM DATA SNAPSHOT:
====================

SUMMARY STATISTICS:
- Total Candidates: ${totalCandidates}
- Total Jobs: ${totalJobs} (${activeJobs} active)
- Total Applications: ${totalApplications}
- Average AI Score: ${avgScore.toFixed(1)}
- Status Breakdown: ${Object.entries(statusBreakdown).map(([k,v]) => `${k}: ${v}`).join(", ")}

CANDIDATES (${totalCandidates}):
${candidateSummaries || "No candidates yet"}

JOBS (${totalJobs}):
${jobSummaries || "No jobs yet"}

UPCOMING INTERVIEWS:
${interviewSummaries || "No interviews scheduled"}

MESSAGE TEMPLATES: ${templates?.length || 0} templates available
MESSAGES SENT: ${messagesSent?.length || 0} total

RECENT ACTIVITY (last 50):
${(recentActivity || []).slice(0, 20).map(a => `- ${a.action} | ${a.created_at?.split("T")[0]} | ${JSON.stringify(a.details || {})}`).join("\n") || "No recent activity"}

YOUR CAPABILITIES:
1. Answer questions about candidates, jobs, interviews, and pipeline status
2. Recommend candidates for specific jobs based on scores and skills
3. Identify bottlenecks in the hiring pipeline
4. Suggest interview questions based on candidate profiles
5. Analyze hiring trends and provide insights
6. Help draft messages to candidates
7. Provide status reports and summaries
8. Flag candidates that need attention (long wait times, missing info, etc.)

IMPORTANT RULES:
- Always respond in the same language as the user's message
- Be concise but thorough
- Use specific data from the system when answering
- If asked about a specific candidate/job, provide detailed information
- Provide actionable recommendations, not just observations
- Format responses with clear structure (bullets, headers)
- If data is missing or insufficient, say so clearly`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build messages array with conversation history
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: message });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    return NextResponse.json({ response: content.text });
  } catch (error) {
    console.error("AI Agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI Agent failed" },
      { status: 500 }
    );
  }
}
