import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { buildHRBrainContext } from "@/lib/claude/hr-brain-context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();
  const scope = url.searchParams.get("scope"); // company, department, employee

  let query = supabase
    .from("hr_brain_scores")
    .select("*")
    .order("score", { ascending: false });

  if (scope) query = query.eq("scope", scope);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scores: data || [] });
}

// Recompute all scores (pure math, no AI call)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  try {
    const ctx = await buildHRBrainContext();
    const supabase = createAdminClient();

    // Upsert company score
    await supabase.from("hr_brain_scores").upsert({
      scope: "company",
      scope_id: null,
      score: ctx.metrics.company_health,
      breakdown: ctx.companyBreakdown,
      computed_at: new Date().toISOString(),
    }, { onConflict: "scope,scope_id" });

    // Upsert department scores
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
      company_health: ctx.metrics.company_health,
      departments: ctx.deptScores.length,
      metrics: ctx.metrics,
    });
  } catch (error) {
    console.error("Score recomputation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recomputation failed" },
      { status: 500 },
    );
  }
}
