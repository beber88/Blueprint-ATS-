import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/system/cron-dispatcher";
import { withRunLog } from "@/lib/system/run-logger";
import { sendEmail } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;
const STUCK_PROCESSING_HOURS = 2;
const STUCK_QUEUED_HOURS = 24;

/**
 * Sweep stage — the safety net. Finds items stuck mid-pipeline
 * (a crashed run leaves reports in 'processing' forever), re-queues
 * what can be retried, and alerts on what cannot. Runs every 6 hours.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await withRunLog("sweep", async (log) => {
    const supabase = createAdminClient();
    const now = Date.now();
    const processingCutoff = new Date(now - STUCK_PROCESSING_HOURS * 3600_000).toISOString();
    const queuedCutoff = new Date(now - STUCK_QUEUED_HOURS * 3600_000).toISOString();

    // 1. Reports stuck in 'processing' (run crashed mid-extraction) → re-queue
    const { data: stuckProcessing } = await supabase
      .from("op_reports")
      .select("id")
      .eq("processing_status", "processing")
      .lt("created_at", processingCutoff);

    if (stuckProcessing && stuckProcessing.length > 0) {
      await supabase
        .from("op_reports")
        .update({ processing_status: "queued" })
        .in("id", stuckProcessing.map((r) => r.id));
    }

    // 2. Failed reports with retries left → re-queue
    const { data: retryable } = await supabase
      .from("op_reports")
      .select("id")
      .eq("processing_status", "failed")
      .lt("attempts", MAX_ATTEMPTS);

    if (retryable && retryable.length > 0) {
      await supabase
        .from("op_reports")
        .update({ processing_status: "queued" })
        .in("id", retryable.map((r) => r.id));
    }

    // 3. Count what is genuinely stuck (old queue items, dead failures, unprocessed emails)
    const [
      { count: stuckQueued },
      { count: deadFailed },
      { count: stuckEmails },
    ] = await Promise.all([
      supabase
        .from("op_reports")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "queued")
        .lt("created_at", queuedCutoff),
      supabase
        .from("op_reports")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "failed")
        .gte("attempts", MAX_ATTEMPTS),
      supabase
        .from("hr_emails")
        .select("id", { count: "exact", head: true })
        .in("processing_status", ["pending", "classified", "failed"])
        .lt("created_at", queuedCutoff),
    ]);

    const requeued = (stuckProcessing?.length || 0) + (retryable?.length || 0);
    log.addItems(requeued);
    log.setDetail("requeued_processing", stuckProcessing?.length || 0);
    log.setDetail("requeued_failed", retryable?.length || 0);
    log.setDetail("stuck_queued", stuckQueued || 0);
    log.setDetail("dead_failed", deadFailed || 0);
    log.setDetail("stuck_emails", stuckEmails || 0);

    const stuckTotal = (stuckQueued || 0) + (deadFailed || 0) + (stuckEmails || 0);
    if (stuckTotal > 0) {
      await alertStuck(supabase, {
        stuckQueued: stuckQueued || 0,
        deadFailed: deadFailed || 0,
        stuckEmails: stuckEmails || 0,
      });
    }

    return {
      requeued,
      stuck_queued: stuckQueued || 0,
      dead_failed: deadFailed || 0,
      stuck_emails: stuckEmails || 0,
    };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}

async function alertStuck(
  supabase: ReturnType<typeof createAdminClient>,
  counts: { stuckQueued: number; deadFailed: number; stuckEmails: number }
): Promise<void> {
  const message = `פריטים תקועים בצנרת העיבוד: ${counts.stuckQueued} דוחות בתור מעל יממה, ${counts.deadFailed} דוחות שנכשלו סופית, ${counts.stuckEmails} מיילים שלא טופלו`;

  try {
    // Avoid stacking duplicate alerts — only one unresolved sweep alert at a time
    const { data: existing } = await supabase
      .from("op_alerts")
      .select("id")
      .eq("type", "critical")
      .ilike("message", "פריטים תקועים בצנרת%")
      .is("resolved_at", null)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("op_alerts").insert({
        type: "critical",
        severity: "high",
        message,
      });

      const alertEmail =
        process.env.SYSTEM_ALERT_EMAIL || process.env.OPERATIONS_CEO_EMAIL;
      if (alertEmail) {
        const html = `<div dir="rtl" style="font-family:Arial,sans-serif"><h3>⚠️ פריטים תקועים בצנרת העיבוד</h3><p>${message}</p><p>המערכת ניסתה לעבד אותם מחדש ללא הצלחה. ניתן לראות פירוט בעמוד "מצב המערכת".</p></div>`;
        await sendEmail(alertEmail, "⚠️ Blueprint — פריטים תקועים בעיבוד", html);
      }
    }
  } catch (err) {
    console.error("sweep: failed to send stuck alert", err);
  }
}

export const POST = GET;
