import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildHRBrainContext } from "@/lib/claude/hr-brain-context";
import { buildHRBrainSystemPrompt } from "@/lib/claude/hr-brain-prompt";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  try {
    // Dismiss old active insights (>7 days) to avoid clutter
    const supabase = createAdminClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("hr_brain_insights")
      .update({ status: "dismissed" })
      .eq("status", "active")
      .lt("created_at", weekAgo);

    // Build context and analyze
    const ctx = await buildHRBrainContext();
    const systemPrompt = buildHRBrainSystemPrompt(ctx.text, "he", "analyze");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Analyze all the HR data and generate actionable insights. Return a JSON array." }],
    });

    const block = response.content[0];
    let insights: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
      recommendation?: string;
    }> = [];

    if (block && block.type === "text") {
      try {
        const text = block.text.trim();
        const jsonStr = text.startsWith("[") ? text : text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
        insights = JSON.parse(jsonStr);
      } catch {
        console.error("Cron: failed to parse insights JSON");
      }
    }

    // Store insights
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

    // Update scores
    await supabase.from("hr_brain_scores").upsert({
      scope: "company",
      scope_id: null,
      score: ctx.metrics.company_health,
      breakdown: ctx.companyBreakdown,
      computed_at: new Date().toISOString(),
    }, { onConflict: "scope,scope_id" });

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
      generated: insights.length,
      stored,
      company_health: ctx.metrics.company_health,
    });
  } catch (error) {
    console.error("AI Brain cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}

export const POST = GET;
