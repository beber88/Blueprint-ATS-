import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Unified daily cron — runs all sub-crons in sequence.
 * Vercel Hobby plan limits cron jobs, so we consolidate
 * everything into one endpoint that fires at 6:00 AM UTC daily.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const baseUrl = request.nextUrl.origin;
  const headers: Record<string, string> = {};
  if (cronSecret) headers["authorization"] = `Bearer ${cronSecret}`;

  const jobs = [
    { name: "email-ingest", path: "/api/hr/email/ingest" },
    { name: "scan-overdue", path: "/api/operations/cron/scan-overdue" },
    { name: "missing-reports", path: "/api/operations/cron/missing-reports" },
    { name: "daily-digest", path: "/api/operations/cron/daily-digest" },
    { name: "contract-deadlines", path: "/api/contracts/cron/scan-deadlines" },
    { name: "refresh-themes", path: "/api/operations/cron/refresh-themes" },
  ];

  const results: { name: string; status: number; ok: boolean; ms: number }[] = [];

  for (const job of jobs) {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}${job.path}`, {
        method: "GET",
        headers,
      });
      results.push({
        name: job.name,
        status: res.status,
        ok: res.ok,
        ms: Date.now() - start,
      });
    } catch (err) {
      results.push({
        name: job.name,
        status: 0,
        ok: false,
        ms: Date.now() - start,
      });
    }
  }

  const allOk = results.every((r) => r.ok);

  return NextResponse.json({
    ok: allOk,
    ran_at: new Date().toISOString(),
    jobs: results,
  });
}
