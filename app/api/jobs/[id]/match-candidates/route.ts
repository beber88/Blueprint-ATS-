import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();
    const { data: matches } = await supabase
      .from("candidate_job_matches")
      .select("*, candidate:candidates(id, full_name, email, phone, profession, experience_years, has_portfolio, status)")
      .eq("job_id", params.id)
      .order("total_score", { ascending: false });
    return NextResponse.json({ matches: matches || [] });
  } catch (error) {
    console.error("Get matches error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const supabase = createAdminClient();
    const { data: job } = await supabase.from("jobs").select("*").eq("id", params.id).single();
    const { data: requirements } = await supabase.from("job_requirements").select("*").eq("job_id", params.id).single();

    if (!requirements) return NextResponse.json({ error: "Define requirements first" }, { status: 400 });

    const { data: candidates } = await supabase
      .from("candidates")
      .select("*")
      .in("status", ["new", "reviewed", "shortlisted", "keep_for_future", "scored"]);

    if (!candidates || candidates.length === 0) return NextResponse.json({ matched: 0, total: 0 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let matched = 0, failed = 0;

    for (let i = 0; i < candidates.length; i += 3) {
      const batch = candidates.slice(i, i + 3);
      await Promise.allSettled(batch.map(async (c) => {
        try {
          const ctx = `Name:${c.full_name}\nExp:${c.experience_years||0}y\nSkills:${(c.skills||[]).join(",")}\nEdu:${c.education||"N/A"}\nCerts:${(c.certifications||[]).join(",")}\nPortfolio:${c.has_portfolio?"Yes":"No"}\nRoles:${JSON.stringify((c.previous_roles||[]).slice(0,3))}`;
          const req = `Job:${job?.title}\nMinExp:${requirements.min_experience_years}y\nSkills:${(requirements.required_skills||[]).join(",")}\nSoftware:${(requirements.required_software||[]).join(",")}\nEdu:${requirements.required_education||"Any"}\nCerts:${(requirements.required_certifications||[]).join(",")}\nPortfolio:${requirements.portfolio_required?"Required":"Optional"}\nDealBreakers:${requirements.deal_breakers||"None"}`;

          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514", max_tokens: 800,
            messages: [{ role: "user", content: `Score candidate vs job. Weights: Exp${requirements.weight_experience}% Skills${requirements.weight_skills}% Edu${requirements.weight_education}% Certs${requirements.weight_certifications}% Portfolio${requirements.weight_portfolio}% Personality${requirements.weight_personality}%\n\nJOB:\n${req}\n\nCANDIDATE:\n${ctx}\n\nReturn ONLY JSON: {"total_score":0,"experience_score":0,"skills_score":0,"education_score":0,"certifications_score":0,"portfolio_score":0,"personality_score":0,"strengths":[],"weaknesses":[],"recommendation":"strong_match|good_match|partial_match|weak_match|not_recommended","ai_reasoning":"","interview_questions":[]}` }]
          });

          const text = response.content[0].type === "text" ? response.content[0].text : "{}";
          const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const m = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(m ? m[0] : cleaned);

          await supabase.from("candidate_job_matches").upsert({
            candidate_id: c.id, job_id: params.id, ...parsed, scored_at: new Date().toISOString(),
          }, { onConflict: "candidate_id,job_id" });
          matched++;
        } catch (e) { failed++; console.error(`Match failed ${c.full_name}:`, e instanceof Error ? e.message : e); }
      }));
      if (i + 3 < candidates.length) await new Promise(r => setTimeout(r, 2000));
    }

    return NextResponse.json({ matched, failed, total: candidates.length });
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
