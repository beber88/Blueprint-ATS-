import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/gmail/client";
import { startRun, finishRun } from "@/lib/system/run-logger";

/**
 * Shared engine for the staged cron dispatchers (/api/cron/*).
 * Each sub-job runs as its own self-fetch (own serverless invocation),
 * gets its own system_runs row, and a failure of one job never hides
 * behind a 200 — failed jobs trigger a Hebrew alert email to the CEO
 * and an op_alerts row so the UI shows it.
 */

export interface CronJob {
  name: string;
  path: string;
}

export interface JobOutcome {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

export function cronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function runJobs(
  stageName: string,
  jobs: CronJob[],
  request: NextRequest
): Promise<{ ok: boolean; results: JobOutcome[] }> {
  const baseUrl = request.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET;
  const headers: Record<string, string> = {};
  if (cronSecret) headers["authorization"] = `Bearer ${cronSecret}`;

  const results: JobOutcome[] = [];

  for (const job of jobs) {
    const runId = await startRun(job.name);
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}${job.path}`, { method: "GET", headers });
      const body = await res.json().catch(() => null);
      const jobOk = res.ok && body?.ok !== false;
      const errorMsg = jobOk
        ? null
        : body?.error || body?.detail || `HTTP ${res.status}`;

      await finishRun(runId, {
        status: jobOk ? "success" : "failed",
        itemsProcessed:
          typeof body?.processed === "number" ? body.processed : 0,
        error: errorMsg,
        details: body && typeof body === "object" ? body : {},
      });

      results.push({
        name: job.name,
        ok: jobOk,
        status: res.status,
        ms: Date.now() - start,
        error: errorMsg || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await finishRun(runId, { status: "failed", error: message });
      results.push({
        name: job.name,
        ok: false,
        status: 0,
        ms: Date.now() - start,
        error: message,
      });
    }
  }

  const failedJobs = results.filter((r) => !r.ok);
  if (failedJobs.length > 0) {
    await alertOnFailures(stageName, failedJobs);
  }

  return { ok: failedJobs.length === 0, results };
}

async function alertOnFailures(stageName: string, failed: JobOutcome[]): Promise<void> {
  const jobList = failed
    .map((f) => `${f.name}: ${f.error || "שגיאה לא ידועה"}`)
    .join(" | ");

  // In-app alert (op_alerts feeds the operations alerts page)
  try {
    const supabase = createAdminClient();
    await supabase.from("op_alerts").insert({
      type: "critical",
      severity: "high",
      message: `תקלה במשימות הרקע (${stageName}): ${jobList}`.slice(0, 1000),
    });
  } catch (err) {
    console.error("cron-dispatcher: failed to insert op_alerts row", err);
  }

  // Email alert to the CEO/admin
  const alertEmail =
    process.env.SYSTEM_ALERT_EMAIL || process.env.OPERATIONS_CEO_EMAIL;
  if (!alertEmail) return;
  try {
    // sendEmail replaces \n with <br>, so keep the HTML single-line.
    const rows = failed
      .map(
        (f) =>
          `<li><b>${f.name}</b> — ${f.error || "שגיאה לא ידועה"} (סטטוס ${f.status})</li>`
      )
      .join("");
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif"><h3>⚠️ תקלה במשימות הרקע של המערכת</h3><p>שלב: <b>${stageName}</b> | זמן: ${new Date().toISOString()}</p><ul>${rows}</ul><p>ניתן לראות פירוט מלא בעמוד "מצב המערכת" בדשבורד התפעול.</p></div>`;
    await sendEmail(alertEmail, `⚠️ Blueprint — תקלה במשימות רקע (${stageName})`, html);
  } catch (err) {
    console.error("cron-dispatcher: failed to send alert email", err);
  }
}
