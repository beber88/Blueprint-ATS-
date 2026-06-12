import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized, runJobs } from "@/lib/system/cron-dispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Digest stage — sends the CEO's daily digest after ingest + analyze
 * have refreshed the data.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, results } = await runJobs(
    "digest",
    [{ name: "daily-digest", path: "/api/operations/cron/daily-digest" }],
    request
  );

  return NextResponse.json({ ok, ran_at: new Date().toISOString(), jobs: results });
}

export const POST = GET;
