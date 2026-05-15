import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCV } from "@/lib/claude/client";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for bulk processing

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { candidateIds } = body as { candidateIds?: string[] };

    const supabase = createAdminClient();

    // Fetch candidates to reclassify
    let query = supabase
      .from("candidates")
      .select("id, full_name, cv_raw_text, job_categories")
      .not("cv_raw_text", "is", null);

    if (candidateIds && candidateIds.length > 0) {
      query = query.in("id", candidateIds);
    } else {
      // Only unclassified candidates
      query = query.or("job_categories.is.null,job_categories.eq.{}");
    }

    const { data: candidates, error } = await query.limit(100);

    if (error) {
      console.error("Reclassify: fetch error", error);
      return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ total: 0, classified: 0, errors: 0, message: "No candidates to classify" });
    }

    console.log(`Reclassify: Starting classification for ${candidates.length} candidates`);

    let classified = 0;
    let errors = 0;
    const results: { id: string; name: string; categories: string[]; status: string }[] = [];

    for (const candidate of candidates) {
      if (!candidate.cv_raw_text || candidate.cv_raw_text.length < 50) {
        results.push({ id: candidate.id, name: candidate.full_name, categories: [], status: "skipped" });
        continue;
      }

      try {
        console.log(`Reclassify: Processing "${candidate.full_name}"...`);
        const parsed = await parseCV(candidate.cv_raw_text);

        const categories = parsed.job_categories || [];
        const confidence = parsed.suggested_job_confidence || 0;
        const suggestedJob = categories[0] || parsed.suggested_job_category || null;

        await supabase.from("candidates").update({
          job_categories: categories,
          classification_confidence: confidence,
          suggested_job: suggestedJob,
          custom_category: parsed.custom_category || null,
        }).eq("id", candidate.id);

        classified++;
        results.push({ id: candidate.id, name: candidate.full_name, categories, status: "classified" });
        console.log(`Reclassify: "${candidate.full_name}" → [${categories.join(", ")}] (${confidence}%)`);
      } catch (err) {
        errors++;
        results.push({ id: candidate.id, name: candidate.full_name, categories: [], status: "error" });
        console.error(`Reclassify: Error for "${candidate.full_name}":`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`Reclassify: Done. Classified: ${classified}, Errors: ${errors}`);

    return NextResponse.json({
      total: candidates.length,
      classified,
      errors,
      results,
    });
  } catch (error) {
    console.error("Reclassify: Unhandled error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
