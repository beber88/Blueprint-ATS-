import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const agentChat = action({
  args: {
    message: v.string(),
    conversationHistory: v.optional(v.array(v.object({
      role: v.string(),
      content: v.string(),
    }))),
    candidateIds: v.optional(v.array(v.id("candidates"))),
    mode: v.optional(v.string()), // general, candidate, compare
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const locale = args.locale || "he";

    // Fetch system data
    const allCandidates = await ctx.runQuery(api.candidates.list, { limit: 200 });
    const jobs = await ctx.runQuery(api.jobs.list, {});
    const categories = await ctx.runQuery(api.admin.listCategories, {});

    const candidatesList = allCandidates.candidates || [];

    // Build candidate profiles
    const buildProfile = (c: Record<string, unknown>) => {
      const cats = (c.job_categories as string[]) || [];
      const catNames = cats.map((k: string) => {
        const cat = (categories as Record<string, unknown>[]).find((ct: Record<string, unknown>) => ct.key === k);
        return cat ? `${cat.name_en} (${cat.name_he})` : k;
      });
      const analysis = c.ai_analysis as Record<string, unknown> | null;

      return `
══════════════════════════════════════
CANDIDATE: ${c.full_name}
══════════════════════════════════════
ID: ${c._id}
Email: ${c.email || "N/A"} | Phone: ${c.phone || "N/A"} | Location: ${c.location || "N/A"}
Status: ${c.status}

CLASSIFICATION: ${catNames.join(", ") || "Not classified"}
Experience: ${c.experience_years || 0} years | Education: ${c.education || "N/A"}
Skills: ${Array.isArray(c.skills) ? (c.skills as string[]).join(", ") : "None"}
Certifications: ${Array.isArray(c.certifications) ? (c.certifications as string[]).join(", ") : "None"}

CV TEXT (excerpt): ${((c.cv_raw_text as string) || "").slice(0, 2000)}

AI ANALYSIS: ${analysis ? JSON.stringify(analysis, null, 2).slice(0, 1500) : "None"}
`;
    };

    // Build context based on mode
    let dataContext = "";
    const focusedCandidates = args.candidateIds?.length
      ? candidatesList.filter((c: Record<string, unknown>) => args.candidateIds!.includes(c._id as string as never))
      : null;

    if (args.mode === "compare" && focusedCandidates && focusedCandidates.length >= 2) {
      dataContext = `MODE: CANDIDATE COMPARISON\n${focusedCandidates.map(buildProfile).join("\n")}`;
    } else if (args.mode === "candidate" && focusedCandidates && focusedCandidates.length === 1) {
      dataContext = `MODE: DEEP CANDIDATE ANALYSIS\n${buildProfile(focusedCandidates[0])}`;
    } else {
      dataContext = `MODE: FULL SYSTEM OVERVIEW
Total Candidates: ${candidatesList.length}
Total Jobs: ${(jobs as unknown[]).length}

ALL CANDIDATES:
${candidatesList.map(buildProfile).join("\n")}`;
    }

    const systemPrompt = `You are the Blueprint ATS AI Agent - an expert HR advisor with COMPLETE access to all candidate files and system data.

${dataContext}

LANGUAGE: Respond ENTIRELY in ${locale === "he" ? "Hebrew (עברית)" : locale === "tl" ? "Tagalog" : "English"}.
Be SPECIFIC - reference actual candidate names, scores, skills from the data.`;

    const msgs: { role: "user" | "assistant"; content: string }[] = [];
    if (args.conversationHistory) {
      for (const msg of args.conversationHistory.slice(-10)) {
        msgs.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }
    msgs.push({ role: "user", content: args.message });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemPrompt,
      messages: msgs,
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    return { response: content.text };
  },
});

export const smartSearch = action({
  args: {
    query: v.string(),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const locale = args.locale || "he";

    // Fetch categories and candidates
    const categories = await ctx.runQuery(api.admin.listCategories, {});
    const categoryKeys = (categories as { key: string; name_en: string; name_he: string }[]).map(c => c.key).join(", ");

    // Step 1: Parse query
    const parseResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Parse this HR search query into structured parameters.
Available categories: ${categoryKeys}
Query: "${args.query}"

Return ONLY valid JSON:
{
  "professions": ["matching category keys"],
  "count": number (default 10),
  "min_experience": number or null,
  "required_skills": ["specific skills"],
  "sort_priority": "score" | "experience" | "recent",
  "additional_criteria": "free text"
}`,
      }],
    });

    const parseContent = parseResponse.content[0];
    if (parseContent.type !== "text") throw new Error("Parse failed");

    let searchParams;
    try {
      const match = parseContent.text.match(/\{[\s\S]*\}/);
      searchParams = JSON.parse(match ? match[0] : parseContent.text);
    } catch {
      searchParams = { professions: [], count: 10, required_skills: [], sort_priority: "score" };
    }

    // Step 2: Query candidates
    const result = await ctx.runQuery(api.candidates.search, {
      professions: searchParams.professions || [],
      min_experience: searchParams.min_experience || undefined,
      required_skills: searchParams.required_skills?.length ? searchParams.required_skills : undefined,
      per_page: 100,
    });

    const candidates = result.candidates || [];
    if (candidates.length === 0) {
      return {
        candidates: [],
        total: 0,
        total_found: 0,
        search_params: searchParams,
        ai_summary: locale === "he"
          ? "לא נמצאו מועמדים התואמים לחיפוש."
          : "No candidates found matching your search.",
      };
    }

    // Step 3: AI ranking
    const count = Math.min(searchParams.count || 10, candidates.length);
    const langInstruction = locale === "he"
      ? "Write ALL text in Hebrew."
      : locale === "tl" ? "Write ALL text in Tagalog." : "Write ALL text in English.";

    const summaries = candidates.slice(0, 50).map((c: Record<string, unknown>, i: number) => {
      const analysis = c.ai_analysis as Record<string, unknown> | null;
      const verdict = analysis?.verdict as Record<string, unknown> | null;
      return `[${i + 1}] ${c.full_name} (ID: ${c._id})
  Exp: ${c.experience_years || 0}y | Skills: ${((c.skills as string[]) || []).slice(0, 10).join(", ")}
  Score: ${(verdict?.score as number) || c.overall_ai_score || 0} | Level: ${(verdict?.level as string) || "N/A"}`;
    }).join("\n");

    const rankResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Rank top ${count} candidates for: "${args.query}"\n${langInstruction}\n\nCANDIDATES:\n${summaries}\n\nReturn JSON:\n{"ranked":[{"rank":1,"candidate_id":"id","score":0-100,"reasoning":"why","strengths":["s1","s2"]}],"summary":"brief summary"}`,
      }],
    });

    const rankContent = rankResponse.content[0];
    if (rankContent.type !== "text") throw new Error("Rank failed");

    let ranking;
    try {
      const match = rankContent.text.match(/\{[\s\S]*\}/);
      ranking = JSON.parse(match ? match[0] : rankContent.text);
    } catch {
      ranking = { ranked: [], summary: "" };
    }

    // Step 4: Build response
    const rankedCandidates = (ranking.ranked || []).map((r: Record<string, unknown>) => {
      const candidate = candidates.find((c: Record<string, unknown>) => c._id === r.candidate_id);
      if (!candidate) return null;
      const analysis = (candidate as Record<string, unknown>).ai_analysis as Record<string, unknown> | null;
      const verdict = analysis?.verdict as Record<string, unknown> | null;

      return {
        rank: r.rank,
        ai_search_score: r.score,
        reasoning: r.reasoning,
        strengths: r.strengths,
        candidate: {
          id: (candidate as Record<string, unknown>)._id,
          full_name: (candidate as Record<string, unknown>).full_name,
          email: (candidate as Record<string, unknown>).email,
          phone: (candidate as Record<string, unknown>).phone,
          location: (candidate as Record<string, unknown>).location,
          experience_years: (candidate as Record<string, unknown>).experience_years,
          skills: (candidate as Record<string, unknown>).skills,
          education: (candidate as Record<string, unknown>).education,
          certifications: (candidate as Record<string, unknown>).certifications,
          previous_roles: (candidate as Record<string, unknown>).previous_roles,
          job_categories: (candidate as Record<string, unknown>).job_categories,
          status: (candidate as Record<string, unknown>).status,
          ai_total_score: (verdict?.score as number) || (candidate as Record<string, unknown>).overall_ai_score || null,
          verdict_recommendation: (verdict?.recommendation as string) || null,
          verdict_level: (verdict?.level as string) || null,
        },
      };
    }).filter(Boolean);

    return {
      candidates: rankedCandidates,
      total: rankedCandidates.length,
      total_found: candidates.length,
      search_params: searchParams,
      ai_summary: ranking.summary || "",
    };
  },
});
