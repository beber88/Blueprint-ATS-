import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized, runJobs, JobOutcome } from "@/lib/system/cron-dispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual "run everything now" fallback. The scheduled work moved to the
 * staged dispatchers (/api/cron/ingest, /api/cron/analyze, /api/cron/digest,
 * /api/cron/sweep — see vercel.json); this endpoint remains for manual
 * recovery and debugging.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all: JobOutcome[] = [];

  const ingest = await runJobs(
    "ingest",
    [
      { name: "email-ingest", path: "/api/hr/email/ingest" },
      { name: "process-queued-reports", path: "/api/operations/reports/process-queued" },
    ],
    request
  );
  all.push(...ingest.results);

  const analyze = await runJobs(
    "analyze",
    [
      { name: "scan-overdue", path: "/api/operations/cron/scan-overdue" },
      { name: "missing-reports", path: "/api/operations/cron/missing-reports" },
      { name: "contract-deadlines", path: "/api/contracts/cron/scan-deadlines" },
      { name: "refresh-themes", path: "/api/operations/cron/refresh-themes" },
      { name: "ai-brain", path: "/api/ai-brain/cron" },
    ],
    request
  );
  all.push(...analyze.results);

  const digest = await runJobs(
    "digest",
    [{ name: "daily-digest", path: "/api/operations/cron/daily-digest" }],
    request
  );
  all.push(...digest.results);

  return NextResponse.json({
    ok: all.every((r) => r.ok),
    ran_at: new Date().toISOString(),
    jobs: all,
  });
}

export const POST = GET;
