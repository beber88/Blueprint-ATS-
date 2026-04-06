import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

interface ParsedSearch {
  profession: string | null;
  keywords: string[];
  required_skills: string[];
  min_experience: number | null;
  max_experience: number | null;
  limit: number;
  sort_by: "experience" | "score" | "relevance";
  status_filter: string[];
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const { query, locale = "he" } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Fetch available professions for context
    const { data: categories } = await supabase
      .from("job_categories")
      .select("key, name_en, name_he")
      .order("sort_order");

    const professionList = (categories || [])
      .map((c: { key: string; name_en: string; name_he: string }) => `${c.key} (${c.name_en} / ${c.name_he})`)
      .join(", ");

    // Step 1: Parse natural language query into structured search
    const parseResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Parse this recruiter search query into structured JSON. The query is from an ATS (Applicant Tracking System) for the construction industry.

Available professions in the system: ${professionList}

Query: "${query}"

Return JSON with these fields:
{
  "profession": "matching profession key from the list above, or null if not specified",
  "keywords": ["additional search keywords from the query"],
  "required_skills": ["specific skills mentioned"],
  "min_experience": number or null,
  "max_experience": number or null,
  "limit": number (how many results requested, default 10),
  "sort_by": "experience" | "score" | "relevance",
  "status_filter": ["specific statuses if mentioned, e.g. approved, shortlisted"]
}

Important:
- Match profession names in any language (Hebrew, English, Tagalog)
- "הטובים ביותר" / "best" / "top" means sort by score descending
- "מנוסים" / "experienced" means sort by experience descending
- If they say "אדריכל" match to "architect" profession key
- If they say "מהנדס" match to the relevant engineer profession key
- Return ONLY valid JSON, nothing else.`,
        },
      ],
    });

    const parseContent = parseResponse.content[0];
    if (parseContent.type !== "text") {
      return NextResponse.json({ error: "Failed to parse query" }, { status: 500 });
    }

    let parsed: ParsedSearch;
    try {
      const jsonMatch = parseContent.text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : parseContent.text);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Step 2: Query database with parsed parameters
    let dbQuery = supabase
      .from("candidates")
      .select("*, applications(id, ai_score, status, job:jobs(title))", { count: "exact" });

    // Filter by profession
    if (parsed.profession) {
      dbQuery = dbQuery.contains("job_categories", [parsed.profession]);
    }

    // Filter by experience
    if (parsed.min_experience != null) {
      dbQuery = dbQuery.gte("experience_years", parsed.min_experience);
    }
    if (parsed.max_experience != null) {
      dbQuery = dbQuery.lte("experience_years", parsed.max_experience);
    }

    // Filter by status
    if (parsed.status_filter && parsed.status_filter.length > 0) {
      dbQuery = dbQuery.in("status", parsed.status_filter);
    }

    // Filter by skills
    if (parsed.required_skills && parsed.required_skills.length > 0) {
      dbQuery = dbQuery.contains("skills", parsed.required_skills);
    }

    // Sort
    if (parsed.sort_by === "experience") {
      dbQuery = dbQuery.order("experience_years", { ascending: false, nullsFirst: false });
    } else if (parsed.sort_by === "score") {
      dbQuery = dbQuery.order("overall_ai_score", { ascending: false, nullsFirst: false });
    } else {
      // relevance: sort by score first, then experience
      dbQuery = dbQuery.order("overall_ai_score", { ascending: false, nullsFirst: false });
      dbQuery = dbQuery.order("experience_years", { ascending: false, nullsFirst: false });
    }

    // Apply limit
    const limit = Math.min(parsed.limit || 10, 50);
    dbQuery = dbQuery.limit(limit);

    const { data: candidates, count, error } = await dbQuery;

    if (error) {
      console.error("Smart search DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If we have keyword search and not enough results from profession filter, try text search
    if ((!candidates || candidates.length === 0) && parsed.keywords.length > 0) {
      const keyword = parsed.keywords[0];
      let fallbackQuery = supabase
        .from("candidates")
        .select("*, applications(id, ai_score, status, job:jobs(title))", { count: "exact" })
        .or(`full_name.ilike.%${keyword}%,cv_raw_text.ilike.%${keyword}%`)
        .order("overall_ai_score", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (parsed.min_experience != null) {
        fallbackQuery = fallbackQuery.gte("experience_years", parsed.min_experience);
      }

      const { data: fallbackCandidates, count: fallbackCount } = await fallbackQuery;

      if (fallbackCandidates && fallbackCandidates.length > 0) {
        return buildResponse(anthropic, fallbackCandidates, fallbackCount || 0, query, parsed, locale, categories || []);
      }
    }

    return buildResponse(anthropic, candidates || [], count || 0, query, parsed, locale, categories || []);
  } catch (error) {
    console.error("Smart search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Smart search failed" },
      { status: 500 }
    );
  }
}

async function buildResponse(
  anthropic: Anthropic,
  candidates: Record<string, unknown>[],
  totalFound: number,
  originalQuery: string,
  parsed: ParsedSearch,
  locale: string,
  categories: { key: string; name_en: string; name_he: string }[]
) {
  const langName = locale === "he" ? "Hebrew (עברית)" : locale === "tl" ? "Tagalog" : "English";

  // Build candidate summaries for AI
  const candidateSummaries = candidates.map((c, i) => {
    const apps = (c.applications as { ai_score: number | null }[]) || [];
    const scores = apps.map((a) => a.ai_score).filter((s): s is number => s !== null);
    const topScore = scores.length > 0 ? Math.max(...scores) : (c.overall_ai_score as number | null);
    const cats = ((c.job_categories as string[]) || []).map((k) => {
      const cat = categories.find((ct) => ct.key === k);
      return cat ? (locale === "he" ? cat.name_he : cat.name_en) : k;
    });

    return `${i + 1}. ${c.full_name} | ${cats.join(", ") || "N/A"} | ${c.experience_years || 0} yrs exp | Score: ${topScore ?? "N/A"} | Skills: ${(c.skills as string[] || []).slice(0, 8).join(", ")} | Status: ${c.status}`;
  });

  // Generate AI summary
  const summaryResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an ATS assistant. A recruiter searched: "${originalQuery}"

Found ${candidates.length} candidates (${totalFound} total matching):

${candidateSummaries.join("\n")}

Write a brief, helpful summary of the results in ${langName}. Include:
1. A one-line answer to their query
2. Quick highlights of the top 3 candidates (if available)
3. A one-line recommendation

Keep it concise and actionable. Respond ENTIRELY in ${langName}.`,
      },
    ],
  });

  const summaryContent = summaryResponse.content[0];
  const summary = summaryContent.type === "text" ? summaryContent.text : "";

  return NextResponse.json({
    candidates,
    total: totalFound,
    limit: parsed.limit || 10,
    parsed_query: parsed,
    ai_summary: summary,
  });
}
