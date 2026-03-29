import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const { message, conversationHistory, candidateIds, mode } = await request.json();
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch ALL system data with FULL depth
    const [
      { data: allCandidates },
      { data: jobs },
      { data: applications },
      { data: interviews },
      { data: recentActivity },
      { data: categories },
    ] = await Promise.all([
      supabase.from("candidates").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("*, candidate:candidates(full_name), job:jobs(title)").order("applied_at", { ascending: false }).limit(500),
      supabase.from("interviews").select("*, application:applications(candidate:candidates(full_name), job:jobs(title))").order("scheduled_at", { ascending: false }).limit(100),
      supabase.from("activity_log").select("*, candidate:candidates(full_name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("job_categories").select("*").order("sort_order"),
    ]);

    // If specific candidates requested (for comparison or deep dive)
    const focusedCandidates = candidateIds?.length
      ? (allCandidates || []).filter(c => candidateIds.includes(c.id))
      : null;

    // Build DEEP candidate profiles - like NotebookLM, include EVERYTHING
    const buildCandidateProfile = (c: Record<string, unknown>) => {
      const apps = (applications || []).filter(a => a.candidate_id === c.id);
      const ints = (interviews || []).filter(i => {
        const app = applications?.find(a => a.id === i.application_id);
        return app?.candidate_id === c.id;
      });
      const acts = (recentActivity || []).filter(a => a.candidate_id === c.id);
      const cats = (c.job_categories as string[]) || [];
      const catNames = cats.map(k => {
        const cat = categories?.find(ct => ct.key === k);
        return cat ? `${cat.name_en} (${cat.name_he})` : k;
      });
      const analysis = c.ai_analysis as Record<string, unknown> | null;
      const docs = (c.documents as { name: string; type: string }[]) || [];

      return `
══════════════════════════════════════
CANDIDATE: ${c.full_name}
══════════════════════════════════════
ID: ${c.id}
Email: ${c.email || "N/A"} | Phone: ${c.phone || "N/A"} | Location: ${c.location || "N/A"}
Status: ${c.status} | Contact Status: ${c.contact_status || "none"}
Added: ${(c.created_at as string)?.split("T")[0] || "N/A"}

PROFESSIONAL CLASSIFICATION:
${catNames.length > 0 ? catNames.map(n => `  • ${n}`).join("\n") : "  Not classified yet"}
${c.custom_category ? `  Custom: ${c.custom_category}` : ""}
Confidence: ${c.classification_confidence || "N/A"}%

EXPERIENCE & EDUCATION:
  Years of Experience: ${c.experience_years || 0}
  Education: ${c.education || "N/A"}
  Certifications: ${Array.isArray(c.certifications) && (c.certifications as string[]).length > 0 ? (c.certifications as string[]).join(", ") : "None listed"}

SKILLS:
  ${Array.isArray(c.skills) && (c.skills as string[]).length > 0 ? (c.skills as string[]).join(", ") : "None listed"}

PREVIOUS ROLES:
${Array.isArray(c.previous_roles) && (c.previous_roles as Record<string, string>[]).length > 0
  ? (c.previous_roles as Record<string, string>[]).map(r => `  • ${r.title || "?"} at ${r.company || "?"} (${r.duration || "?"}) - ${r.description || ""}`).join("\n")
  : "  No roles listed"}

CV RAW TEXT (${((c.cv_raw_text as string) || "").length} chars):
${c.cv_raw_text ? (c.cv_raw_text as string).slice(0, 3000) : "No CV text available"}
${((c.cv_raw_text as string) || "").length > 3000 ? "\n  ...[truncated]" : ""}

ADDITIONAL DOCUMENTS: ${docs.length > 0 ? docs.map(d => `${d.name} (${d.type})`).join(", ") : "None"}

AI ANALYSIS:
${analysis ? JSON.stringify(analysis, null, 2).slice(0, 2000) : "No AI analysis performed yet"}

JOB APPLICATIONS (${apps.length}):
${apps.length > 0 ? apps.map(a => `  • Job: ${(a.job as Record<string, string>)?.title || a.job_id} | Score: ${a.ai_score ?? "N/A"} | Status: ${a.status} | Reasoning: ${a.ai_reasoning || "N/A"}`).join("\n") : "  No applications"}

INTERVIEWS (${ints.length}):
${ints.length > 0 ? ints.map(i => `  • ${i.scheduled_at?.split("T")[0] || "?"} | Type: ${i.type} | Duration: ${i.duration_minutes}min | Interviewer: ${i.interviewer || "N/A"} | Outcome: ${i.outcome || "pending"} | Notes: ${i.notes || "none"}`).join("\n") : "  No interviews"}

ACTIVITY LOG (${acts.length}):
${acts.slice(0, 10).map(a => `  • ${a.action} - ${(a.created_at as string)?.split("T")[0] || "?"} ${JSON.stringify(a.details || {})}`).join("\n") || "  No activity"}
`;
    };

    // Build system context based on mode
    let dataContext = "";

    if (mode === "compare" && focusedCandidates && focusedCandidates.length >= 2) {
      // COMPARISON MODE - full deep profiles of selected candidates
      dataContext = `
MODE: CANDIDATE COMPARISON
You are comparing ${focusedCandidates.length} candidates side by side.
Provide detailed comparison on every dimension.

${focusedCandidates.map(c => buildCandidateProfile(c)).join("\n")}
`;
    } else if (mode === "candidate" && focusedCandidates && focusedCandidates.length === 1) {
      // DEEP DIVE into single candidate
      dataContext = `
MODE: DEEP CANDIDATE ANALYSIS
You have the COMPLETE file for this candidate. Answer ANY question about them.

${buildCandidateProfile(focusedCandidates[0])}
`;
    } else {
      // FULL SYSTEM MODE - overview of everything
      const totalCandidates = allCandidates?.length || 0;
      const totalJobs = jobs?.length || 0;
      const activeJobs = jobs?.filter(j => j.status === "active").length || 0;
      const statusBreakdown: Record<string, number> = {};
      allCandidates?.forEach(c => { statusBreakdown[c.status as string] = (statusBreakdown[c.status as string] || 0) + 1; });

      // Category breakdown
      const catBreakdown: Record<string, number> = {};
      allCandidates?.forEach(c => {
        ((c.job_categories as string[]) || []).forEach(cat => { catBreakdown[cat] = (catBreakdown[cat] || 0) + 1; });
      });

      dataContext = `
MODE: FULL SYSTEM OVERVIEW
You have access to ALL data in the ATS system.

SUMMARY:
- Total Candidates: ${totalCandidates}
- Total Jobs: ${totalJobs} (${activeJobs} active)
- Total Applications: ${applications?.length || 0}
- Total Interviews: ${interviews?.length || 0}
- Status Breakdown: ${Object.entries(statusBreakdown).map(([k,v]) => `${k}:${v}`).join(", ")}
- Profession Breakdown: ${Object.entries(catBreakdown).map(([k,v]) => {
  const cat = categories?.find(ct => ct.key === k);
  return `${cat?.name_en || k}:${v}`;
}).join(", ")}

JOBS:
${(jobs || []).map(j => {
  const jobApps = (applications || []).filter(a => a.job_id === j.id);
  const scores = jobApps.map(a => a.ai_score).filter(Boolean) as number[];
  return `• ${j.title} | ${j.department || ""} | ${j.location || ""} | Status: ${j.status} | ${jobApps.length} candidates | Avg: ${scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(0) : "N/A"} | Top: ${scores.length ? Math.max(...scores) : "N/A"}`;
}).join("\n")}

ALL CANDIDATES (FULL PROFILES):
${(allCandidates || []).map(c => buildCandidateProfile(c)).join("\n")}

RECENT ACTIVITY:
${(recentActivity || []).slice(0, 30).map(a => `• ${(a.candidate as Record<string, string>)?.full_name || "?"} | ${a.action} | ${(a.created_at as string)?.split("T")[0]} | ${JSON.stringify(a.details || {})}`).join("\n")}
`;
    }

    const systemPrompt = `You are the Blueprint ATS AI Agent - an expert HR advisor with COMPLETE access to all candidate files, CVs, analyses, and system data. You operate like NotebookLM - you know EVERYTHING about every candidate in the system.

${dataContext}

YOUR CAPABILITIES:
1. DEEP CANDIDATE KNOWLEDGE: You have read every CV, every analysis, every score. You can answer specific questions about any candidate's background, skills, experience, and qualifications.
2. SMART COMPARISON: When comparing candidates, analyze each dimension systematically - experience, skills match, education, certifications, AI scores, strengths/weaknesses.
3. HIRING RECOMMENDATIONS: Based on all available data, recommend the best candidates for specific roles with clear reasoning.
4. GAP ANALYSIS: Identify what's missing in the candidate pool for each job category.
5. INTERVIEW PREP: Generate tailored interview questions based on each candidate's specific CV and background.
6. EXECUTIVE BRIEFING: Produce professional reports and summaries for the CEO.
7. TREND ANALYSIS: Identify patterns across candidates - common skills, experience levels, score distributions.
8. PROACTIVE ALERTS: Flag candidates who need attention, long-waiting candidates, missing information, etc.

RESPONSE RULES:
- ALWAYS respond in the SAME LANGUAGE as the user's message (Hebrew/English/Tagalog)
- Be SPECIFIC - reference actual candidate names, scores, skills from the data
- When comparing, use tables or structured format
- Provide ACTIONABLE recommendations, not generic advice
- If asked about a specific candidate, use ALL available data including CV text
- Format with clear headers, bullets, and structure
- When recommending hiring decisions, always explain WHY with specific evidence from the data`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msgs: { role: "user" | "assistant"; content: string }[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        msgs.push({ role: msg.role, content: msg.content });
      }
    }
    msgs.push({ role: "user", content: message });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemPrompt,
      messages: msgs,
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
