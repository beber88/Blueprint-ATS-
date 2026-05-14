import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitReports } from "@/lib/operations/bulk-split";
import {
  BULK_IMPORT_MAX_REPORTS,
  DEDUP_WINDOW_HOURS,
  hashSourceText,
  type PreviewResult,
} from "@/lib/operations/bulk-import";
import { estimateBulkCost } from "@/lib/operations/bulk-cost";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface PreviewBody {
  text: string;
}

export async function POST(request: NextRequest) {
  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.text || body.text.trim().length < 100) {
    return NextResponse.json(
      { error: "text required (min 100 chars)" },
      { status: 400 }
    );
  }

  const chunks = splitReports(body.text);
  const dates = chunks.map((c) => c.date).filter((d): d is string => Boolean(d));
  dates.sort();

  const cost = estimateBulkCost(body.text, chunks.length);
  const sourceTextHash = hashSourceText(body.text);
  const capExceeded = chunks.length > BULK_IMPORT_MAX_REPORTS;

  // Dedup lookup: did we recently process this exact text?
  let duplicateJobId: string | undefined;
  let duplicateJobCreatedAt: string | undefined;
  try {
    const supabase = createAdminClient();
    const since = new Date(
      Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();
    const { data: prior } = await supabase
      .from("op_bulk_import_jobs")
      .select("id, created_at")
      .eq("source_text_hash", sourceTextHash)
      .eq("status", "done")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior) {
      duplicateJobId = prior.id as string;
      duplicateJobCreatedAt = prior.created_at as string;
    }
  } catch (e) {
    // Dedup lookup is advisory. If the table doesn't exist yet (migration 006
    // not applied) or the query fails, we still return a useful preview.
    console.warn("bulk-import preview: dedup lookup failed", {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const result: PreviewResult = {
    detectedReports: chunks.length,
    dateRange: {
      from: dates[0] || null,
      to: dates[dates.length - 1] || null,
    },
    estimatedInputTokens: cost.inputTokens,
    estimatedOutputTokens: cost.outputTokens,
    estimatedCostUsd: cost.costUsd,
    capExceeded,
    cap: BULK_IMPORT_MAX_REPORTS,
    sourceTextHash,
    ...(duplicateJobId ? { duplicateJobId, duplicateJobCreatedAt } : {}),
  };

  if (capExceeded) {
    return NextResponse.json(
      {
        ...result,
        error: `Batch contains ${chunks.length} reports — exceeds cap of ${BULK_IMPORT_MAX_REPORTS}. Split the paste into smaller batches.`,
      },
      { status: 422 }
    );
  }

  return NextResponse.json(result);
}
