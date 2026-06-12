import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { getLastRunPerJob, getRecentRuns } from "@/lib/system/run-logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/health — admin view of the background pipeline:
 * last run per job, failures in the last 24h, stuck item counts, and
 * pending brain questions. Powers the system-health strip in the UI.
 */
export async function GET(request: NextRequest) {
  // Allow CRON_SECRET bearer for debugging; otherwise admin session
  const cronSecret = process.env.CRON_SECRET;
  const bearerOk =
    !!cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!bearerOk) {
    const { error: authError } = await requireApiAuth({ minimumRole: "admin" });
    if (authError) return authError;
  }

  try {
    const supabase = createAdminClient();
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

    const [lastRuns, recentRuns, queuedRes, failedRes, emailsRes, questionsRes] =
      await Promise.all([
        getLastRunPerJob(),
        getRecentRuns(100),
        supabase
          .from("op_reports")
          .select("id", { count: "exact", head: true })
          .eq("processing_status", "queued"),
        supabase
          .from("op_reports")
          .select("id", { count: "exact", head: true })
          .eq("processing_status", "failed"),
        supabase
          .from("hr_emails")
          .select("id", { count: "exact", head: true })
          .in("processing_status", ["pending", "classified", "failed"])
          .lt("created_at", dayAgo),
        supabase
          .from("op_context_questions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

    const failures24h = recentRuns.filter(
      (r) => r.status === "failed" && r.started_at >= dayAgo
    );

    const lastSuccess = lastRuns
      .filter((r) => r.status === "success")
      .map((r) => r.finished_at || r.started_at)
      .sort()
      .pop();

    return NextResponse.json({
      ok: failures24h.length === 0,
      last_success_at: lastSuccess || null,
      last_runs: lastRuns,
      failures_24h: failures24h.map((r) => ({
        job_name: r.job_name,
        started_at: r.started_at,
        error: r.error,
      })),
      stuck: {
        reports_queued: queuedRes.count || 0,
        reports_failed: failedRes.count || 0,
        emails_unprocessed: emailsRes.count || 0,
      },
      pending_questions: questionsRes.count || 0,
    });
  } catch (error) {
    console.error("system health error:", error);
    return NextResponse.json({ error: "Failed to load system health" }, { status: 500 });
  }
}
