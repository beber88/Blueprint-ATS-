import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized, runJobs } from "@/lib/system/cron-dispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Ingest stage — pulls emails (incl. daily-report PDF attachments) and
 * drains the report extraction queue. Scheduled 3× daily so reports that
 * arrive in the evening are processed the same day.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, results } = await runJobs(
    "ingest",
    [
      { name: "email-ingest", path: "/api/hr/email/ingest" },
      { name: "process-queued-reports", path: "/api/operations/reports/process-queued" },
    ],
    request
  );

  return NextResponse.json({ ok, ran_at: new Date().toISOString(), jobs: results });
}

export const POST = GET;
