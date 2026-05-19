import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { buildHRBrainContext } from "@/lib/claude/hr-brain-context";
import { buildHRBrainSystemPrompt } from "@/lib/claude/hr-brain-prompt";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "hr-management" });
    if (authError) return authError;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const locale = (body.locale as "he" | "en" | "tl") || "he";

    // Build full context
    const ctx = await buildHRBrainContext();
    const systemPrompt = buildHRBrainSystemPrompt(ctx.text, locale, "analyze");

    // Call Claude for analysis
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Analyze all the HR data and generate actionable insights. Return a JSON array." }],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") {
      return NextResponse.json({ error: "Bad AI response" }, { status: 500 });
    }

    // Parse insights from Claude response
    let insights: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
      recommendation?: string;
    }> = [];
    try {
      const text = block.text.trim();
      // Handle potential markdown wrapping
      const jsonStr = text.startsWith("[") ? text : text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
      insights = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, still return metrics
      console.error("Failed to parse AI insights JSON:", block.text.slice(0, 200));
    }

    // Store insights in database
    const supabase = createAdminClient();
    let stored = 0;
    for (const ins of insights) {
      const { error } = await supabase.from("hr_brain_insights").insert({
        type: ins.type,
        severity: ins.severity || "info",
        title: ins.title,
        description: ins.description,
        recommendation: ins.recommendation || null,
        status: "active",
      });
      if (!error) stored++;
    }

    // Update company score
    await supabase.from("hr_brain_scores").upsert({
      scope: "company",
      scope_id: null,
      score: ctx.metrics.company_health,
      breakdown: ctx.companyBreakdown,
      computed_at: new Date().toISOString(),
    }, { onConflict: "scope,scope_id" });

    // Update department scores
    for (const ds of ctx.deptScores) {
      await supabase.from("hr_brain_scores").upsert({
        scope: "department",
        scope_id: ds.id,
        score: ds.score,
        breakdown: ds.breakdown,
        computed_at: new Date().toISOString(),
      }, { onConflict: "scope,scope_id" });
    }

    return NextResponse.json({
      ok: true,
      insights_generated: insights.length,
      insights_stored: stored,
      metrics: ctx.metrics,
    });
  } catch (error) {
    console.error("AI Brain analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
