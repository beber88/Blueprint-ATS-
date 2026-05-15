import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();
    const { data: job } = await supabase.from("jobs").select("*").eq("id", params.id).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are an HR consultant for Blueprint Building Group Inc., a construction company in the Philippines.
They are hiring for: ${job.title}
Department: ${job.department || "Not specified"}

Generate a questionnaire to define requirements. Return ONLY JSON:
{"sections":[{"title":"string","questions":[{"id":"string","question":"string","type":"number|text|textarea|single_select|multi_select","options":["array"],"placeholder":"string"}]}]}

Include sections: Experience, Technical Skills (with software specific to ${job.title}), Education & Certifications (PRC, PCAB for Philippines), Role at Blueprint, Culture & Personality, Compensation.
Software options must be specific to ${job.title}. Certification options must be Philippines-specific.`
      }]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return NextResponse.json(JSON.parse(match ? match[0] : cleaned));
  } catch (error) {
    console.error("Questionnaire error:", error);
    return NextResponse.json({ error: "Failed to generate questionnaire" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();
    const { data: job } = await supabase.from("jobs").select("*").eq("id", params.id).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const body = await request.json();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Convert questionnaire responses into structured job requirements for ${job.title} at Blueprint Building Group.

Responses: ${JSON.stringify(body.responses, null, 2)}

Return ONLY JSON with these fields:
{"min_experience_years":0,"max_experience_years":null,"required_education":"","required_certifications":[],"required_skills":[],"preferred_skills":[],"required_software":[],"work_location":"","personality_traits":[],"language_requirements":[],"portfolio_required":false,"salary_range_min":null,"salary_range_max":null,"role_description":"","ideal_candidate":"","deal_breakers":"","team_context":"","project_context":"","weight_experience":25,"weight_skills":25,"weight_education":15,"weight_certifications":15,"weight_portfolio":10,"weight_personality":10}`
      }]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const requirements = JSON.parse(match ? match[0] : cleaned);

    const { data, error } = await supabase.from("job_requirements").upsert({
      job_id: params.id,
      ...requirements,
      questionnaire_responses: body.responses,
    }, { onConflict: "job_id" }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requirements: data });
  } catch (error) {
    console.error("Save requirements error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
