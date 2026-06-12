import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized, runJobs } from "@/lib/system/cron-dispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Analyze stage — alerts, deadlines, theme clustering, and the AI brain.
 * Runs after the morning ingest so it sees today's data.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, results } = await runJobs(
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

  return NextResponse.json({ ok, ran_at: new Date().toISOString(), jobs: results });
}

export const POST = GET;
