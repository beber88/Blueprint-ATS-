import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({});
    if (authError) return authError;

    const supabase = createAdminClient();
    const body = await request.json();
    const { days = 7, lang = "he" } = body;

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    // Run all queries in parallel
    const [
      { data: newCandidates },
      { data: allCandidates },
      { count: interviewCount },
      { count: messagesCount },
      { data: jobs },
    ] = await Promise.all([
      supabase.from("candidates").select("id, full_name, profession, experience_years, overall_ai_score, has_portfolio, status, certifications, created_at").gte("created_at", sinceStr).order("created_at", { ascending: false }),
      supabase.from("candidates").select("id, full_name, profession, experience_years, overall_ai_score, status, has_portfolio").order("overall_ai_score", { ascending: false, nullsFirst: false }),
      supabase.from("interviews").select("*", { count: "exact", head: true }).gte("scheduled_at", sinceStr),
      supabase.from("messages_sent").select("*", { count: "exact", head: true }).gte("created_at", sinceStr),
      supabase.from("jobs").select("id, title, status").eq("status", "active"),
    ]);

    const newList = newCandidates || [];
    const allList = allCandidates || [];

    // By profession
    const byProfession: Record<string, { count: number; newCount: number; avgScore: number; totalScore: number; scored: number; withPortfolio: number; licensed: number; top3: typeof newList }> = {};
    newList.forEach(c => {
      const p = c.profession || "other";
      if (!byProfession[p]) byProfession[p] = { count: 0, newCount: 0, avgScore: 0, totalScore: 0, scored: 0, withPortfolio: 0, licensed: 0, top3: [] };
      byProfession[p].newCount++;
    });
    allList.forEach(c => {
      const p = c.profession || "other";
      if (!byProfession[p]) byProfession[p] = { count: 0, newCount: 0, avgScore: 0, totalScore: 0, scored: 0, withPortfolio: 0, licensed: 0, top3: [] };
      byProfession[p].count++;
      if (c.overall_ai_score) { byProfession[p].totalScore += c.overall_ai_score; byProfession[p].scored++; }
      if (c.has_portfolio) byProfession[p].withPortfolio++;
    });
    Object.values(byProfession).forEach(g => { g.avgScore = g.scored > 0 ? Math.round(g.totalScore / g.scored) : 0; });

    // Top 10 candidates
    const top10 = allList.filter(c => c.overall_ai_score && c.overall_ai_score > 0).slice(0, 10);

    // Pipeline
    const pipeline: Record<string, number> = {};
    allList.forEach(c => { pipeline[c.status || "new"] = (pipeline[c.status || "new"] || 0) + 1; });

    // AI Executive Summary
    let aiSummary = "";
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const langName = lang === "he" ? "Hebrew" : lang === "tl" ? "Tagalog" : "English";
        // Build top candidates detail for AI
        const topCandidatesDetail = top10.slice(0, 5).map(c =>
          `- ${c.full_name} (ID:${c.id}): ${c.profession || "unclassified"}, ${c.experience_years || 0}y exp, score ${c.overall_ai_score || "N/A"}, status: ${c.status}, portfolio: ${c.has_portfolio ? "Yes" : "No"}`
        ).join("\n");

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
          messages: [{
            role: "user",
            content: `Write a professional executive report for the CEO of Blueprint Building Group Inc. (construction company, Philippines).

This report can be generated at ANY time (not just weekly). The CEO uses it to make hiring decisions.

Period: Last ${days} days${days >= 365 ? " (all time)" : ""}.
Data:
- New candidates: ${newList.length}
- Total candidates: ${allList.length}
- Interviews scheduled: ${interviewCount || 0}
- Messages sent: ${messagesCount || 0}
- Open positions: ${jobs?.length || 0}
- Top professions: ${Object.entries(byProfession).sort(([,a],[,b]) => b.newCount - a.newCount).slice(0,5).map(([k,v]) => `${k}: ${v.newCount} new, ${v.count} total, avg score ${v.avgScore}`).join("; ")}
- Pipeline: ${Object.entries(pipeline).map(([k,v]) => `${k}: ${v}`).join(", ")}

Top 5 candidates to consider:
${topCandidatesDetail || "No scored candidates yet"}

STRUCTURE YOUR RESPONSE AS:
1. Executive Summary (2-3 sentences overview)
2. Key Highlights (bullet points)
3. TOP CANDIDATE RECOMMENDATIONS - For each of the top 5 candidates:
   * Name and profession
   * Strengths (why they're good)
   * Concerns (what to watch for)
   * Match score and recommendation (HIRE / HOLD / PASS)
4. Gaps & Concerns (what's missing in the talent pool)
5. Recommended Next Steps (actionable items)

Write ENTIRELY in ${langName}. Be professional, specific, data-driven.
Reference actual candidate names. Be honest about weaknesses.`
          }]
        });
        aiSummary = response.content[0].type === "text" ? response.content[0].text : "";
      } catch (e) { console.error("AI summary error:", e); }
    }

    // Action items
    const actionItems: string[] = [];
    const unreviewed = allList.filter(c => c.status === "new").length;
    if (unreviewed > 5) actionItems.push(lang === "he" ? `${unreviewed} מועמדים חדשים ממתינים לסקירה` : `${unreviewed} new candidates awaiting review`);
    const noScore = allList.filter(c => !c.overall_ai_score).length;
    if (noScore > 0) actionItems.push(lang === "he" ? `${noScore} מועמדים ללא ציון AI` : `${noScore} candidates without AI score`);

    return NextResponse.json({
      period: { days, since: sinceStr, until: new Date().toISOString() },
      summary: {
        new_candidates: newList.length,
        total_candidates: allList.length,
        interviews: interviewCount || 0,
        messages: messagesCount || 0,
        open_positions: jobs?.length || 0,
        avg_score: top10.length > 0 ? Math.round(top10.reduce((s, c) => s + (c.overall_ai_score || 0), 0) / top10.length) : 0,
        with_portfolio: newList.filter(c => c.has_portfolio).length,
      },
      ai_summary: aiSummary,
      by_profession: Object.entries(byProfession).map(([key, data]) => ({ key, ...data })).sort((a, b) => b.newCount - a.newCount),
      top_candidates: top10.map((c, i) => ({ rank: i + 1, ...c })),
      pipeline: Object.entries(pipeline).map(([status, count]) => ({ status, count })),
      action_items: actionItems,
      new_candidates: newList,
    });
  } catch (error) {
    console.error("Weekly report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
