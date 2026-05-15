import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SearchParams {
  professions: string[];
  count: number;
  min_experience?: number;
  max_experience?: number;
  required_skills: string[];
  sort_priority: "score" | "experience" | "recent";
  additional_criteria: string;
}

interface RankedCandidate {
  rank: number;
  candidate_id: string;
  score: number;
  reasoning: string;
  strengths: string[];
}

function extractJSON<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /* noop */ }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) as T; } catch { /* noop */ }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) as T; } catch { /* noop */ }
  }
  // Try array
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) as T; } catch { /* noop */ }
  }
  throw new Error("Failed to extract JSON from response");
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const { query, locale = "he" } = await request.json();
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAdminClient();

    // Fetch job categories for context
    const { data: categories } = await supabase
      .from("job_categories")
      .select("*")
      .order("sort_order");

    const categoryKeys = (categories || []).map(c => c.key).join(", ");
    const categoryMap = (categories || []).reduce((acc: Record<string, string>, c: Record<string, unknown>) => {
      acc[c.key as string] = `${c.name_en} (${c.name_he})`;
      return acc;
    }, {});

    // Step 1: Parse the natural language query into structured search parameters
    const parseResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a search query parser for an HR/ATS system. Parse this natural language search query into structured parameters.

Available profession categories: ${categoryKeys}
Category labels: ${JSON.stringify(categoryMap)}

User query: "${query}"

Return ONLY valid JSON:
{
  "professions": ["array of matching category keys from the list above - can be multiple if user asks broadly like 'engineers'"],
  "count": number (how many results the user wants, default 10),
  "min_experience": number or null,
  "max_experience": number or null,
  "required_skills": ["specific skills mentioned"],
  "sort_priority": "score" | "experience" | "recent",
  "additional_criteria": "any other criteria mentioned in free text"
}

Examples:
- "תמצא לי 10 אדריכלים טובים" → professions: ["architect", "architect_licensed", "architect_intern"], count: 10
- "5 מהנדסים עם 10 שנות ניסיון" → professions: ["engineer", "engineer_civil", "engineer_structural", "engineer_mep", "engineer_electrical", "engineer_mechanical"], count: 5, min_experience: 10
- "the best project managers" → professions: ["project_manager"], count: 10, sort_priority: "score"
- "מנהלי פרויקט עם ניסיון באוטוקאד" → professions: ["project_manager"], required_skills: ["AutoCAD"]`
      }],
    });

    const parseContent = parseResponse.content[0];
    if (parseContent.type !== "text") {
      return NextResponse.json({ error: "Failed to parse query" }, { status: 500 });
    }

    const searchParams = extractJSON<SearchParams>(parseContent.text);

    // Step 2: Query candidates from database
    let dbQuery = supabase
      .from("candidates")
      .select("*, applications(id, ai_score, status, job:jobs(title))")
      .order("created_at", { ascending: false })
      .limit(100);

    // Filter by profession if specified
    if (searchParams.professions.length > 0) {
      dbQuery = dbQuery.overlaps("job_categories", searchParams.professions);
    }

    // Filter by experience
    if (searchParams.min_experience != null) {
      dbQuery = dbQuery.gte("experience_years", searchParams.min_experience);
    }
    if (searchParams.max_experience != null) {
      dbQuery = dbQuery.lte("experience_years", searchParams.max_experience);
    }

    // Filter by skills
    if (searchParams.required_skills.length > 0) {
      dbQuery = dbQuery.contains("skills", searchParams.required_skills);
    }

    const { data: candidates, error } = await dbQuery;

    if (error) {
      console.error("DB query error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        candidates: [],
        total: 0,
        search_params: searchParams,
        ai_summary: locale === "he"
          ? "לא נמצאו מועמדים התואמים לחיפוש שלך. נסה לשנות את הקריטריונים."
          : locale === "tl"
          ? "Walang nakitang kandidato na tumutugma sa iyong paghahanap."
          : "No candidates found matching your search. Try adjusting your criteria.",
      });
    }

    // Step 3: Build candidate summaries for AI ranking
    const candidateSummaries = candidates.map(c => {
      const apps = (c.applications || []) as { ai_score: number | null; status: string; job: { title: string } | null }[];
      const bestScore = apps.reduce((max, a) => Math.max(max, a.ai_score || 0), 0);
      const analysis = c.ai_analysis as Record<string, unknown> | null;
      const verdict = analysis?.verdict as Record<string, unknown> | null;
      const totalScore = (analysis?.total_score as number) || (verdict?.score as number) || 0;

      return {
        id: c.id,
        name: c.full_name,
        experience_years: c.experience_years || 0,
        skills: (c.skills || []).slice(0, 15).join(", "),
        education: c.education || "N/A",
        certifications: (c.certifications || []).join(", ") || "None",
        previous_roles: ((c.previous_roles || []) as { title: string; company: string; duration: string }[])
          .slice(0, 5)
          .map(r => `${r.title} at ${r.company} (${r.duration})`)
          .join("; "),
        job_categories: (c.job_categories || []).join(", "),
        ai_total_score: totalScore,
        best_application_score: bestScore,
        status: c.status,
        location: c.location || "N/A",
        verdict_recommendation: (verdict?.recommendation as string) || "N/A",
        verdict_level: (verdict?.level as string) || "N/A",
      };
    });

    // Step 4: AI ranking
    const count = Math.min(searchParams.count || 10, candidates.length);
    const langInstruction = locale === "he"
      ? "IMPORTANT: Write ALL reasoning and strengths in Hebrew (עברית)."
      : locale === "tl"
      ? "IMPORTANT: Write ALL reasoning and strengths in Tagalog."
      : "IMPORTANT: Write ALL reasoning and strengths in English.";

    const rankResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are an expert HR consultant. Rank and select the top ${count} candidates from the following list based on the search query.

Search query: "${query}"
Additional criteria: ${searchParams.additional_criteria || "None"}
${langInstruction}

CANDIDATES:
${candidateSummaries.map((c, i) => `
[${i + 1}] ${c.name} (ID: ${c.id})
  Experience: ${c.experience_years} years | Location: ${c.location}
  Categories: ${c.job_categories}
  Skills: ${c.skills}
  Education: ${c.education}
  Certifications: ${c.certifications}
  Previous Roles: ${c.previous_roles}
  AI Score: ${c.ai_total_score}/100 | Best App Score: ${c.best_application_score}
  Level: ${c.verdict_level} | Recommendation: ${c.verdict_recommendation}
`).join("\n")}

Return ONLY valid JSON with this structure:
{
  "ranked": [
    {
      "rank": 1,
      "candidate_id": "uuid",
      "score": 0-100,
      "reasoning": "2-3 sentences explaining why this candidate ranks here",
      "strengths": ["strength1", "strength2", "strength3"]
    }
  ],
  "summary": "A brief 2-3 sentence summary of the search results and recommendations"
}`
      }],
    });

    const rankContent = rankResponse.content[0];
    if (rankContent.type !== "text") {
      return NextResponse.json({ error: "Failed to rank candidates" }, { status: 500 });
    }

    const ranking = extractJSON<{ ranked: RankedCandidate[]; summary: string }>(rankContent.text);

    // Step 5: Build final response with full candidate data
    const rankedCandidates = ranking.ranked.map(r => {
      const candidate = candidates.find(c => c.id === r.candidate_id);
      if (!candidate) return null;

      const analysis = candidate.ai_analysis as Record<string, unknown> | null;
      const verdict = analysis?.verdict as Record<string, unknown> | null;

      return {
        rank: r.rank,
        ai_search_score: r.score,
        reasoning: r.reasoning,
        strengths: r.strengths,
        candidate: {
          id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          location: candidate.location,
          experience_years: candidate.experience_years,
          skills: candidate.skills,
          education: candidate.education,
          certifications: candidate.certifications,
          previous_roles: candidate.previous_roles,
          job_categories: candidate.job_categories,
          status: candidate.status,
          ai_total_score: (analysis?.total_score as number) || (verdict?.score as number) || null,
          verdict_recommendation: (verdict?.recommendation as string) || null,
          verdict_level: (verdict?.level as string) || null,
          applications: candidate.applications,
          cv_file_url: candidate.cv_file_url,
          documents: candidate.documents,
        },
      };
    }).filter(Boolean);

    return NextResponse.json({
      candidates: rankedCandidates,
      total: rankedCandidates.length,
      total_found: candidates.length,
      search_params: searchParams,
      ai_summary: ranking.summary,
    });
  } catch (error) {
    console.error("AI Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI Search failed" },
      { status: 500 }
    );
  }
}
