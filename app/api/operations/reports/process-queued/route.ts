import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processReportRow } from "@/lib/operations/report-intake";
import { withRunLog } from "@/lib/system/run-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000; // leave headroom inside maxDuration
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

/**
 * POST/GET /api/operations/reports/process-queued
 *
 * Drains the queue of unprocessed reports through the unified intake
 * pipeline (lib/operations/report-intake.ts) — oldest first, in batches,
 * until the queue is empty or the time budget runs out. Called by the
 * ingest cron; safe to invoke manually.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const result = await withRunLog("process-queued", async (log) => {
    const supabase = createAdminClient();
    const deadline = Date.now() + TIME_BUDGET_MS;

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    while (Date.now() < deadline) {
      const { data: queued, error } = await supabase
        .from("op_reports")
        .select("id, raw_text, report_date, source_meta, storage_path, attempts")
        .eq("processing_status", "queued")
        .lt("attempts", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (error) throw new Error(`queue fetch failed: ${error.message}`);
      if (!queued || queued.length === 0) break;

      for (const report of queued) {
        if (Date.now() >= deadline) break;
        const res = await processReportRow(report);
        if (res.status === "failed") failed++;
        else if (res.status === "skipped") skipped++;
        else processed++;
        log.addItems(1);
      }
    }

    const { count: remaining } = await supabase
      .from("op_reports")
      .select("id", { count: "exact", head: true })
      .eq("processing_status", "queued")
      .lt("attempts", MAX_ATTEMPTS);

    log.setDetail("processed", processed);
    log.setDetail("failed", failed);
    log.setDetail("skipped", skipped);
    log.setDetail("remaining", remaining || 0);

    return { processed, failed, skipped, remaining: remaining || 0 };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result.value });
}

export const POST = GET;
