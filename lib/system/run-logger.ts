import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Persistent audit trail for background jobs (system_runs table).
 * Logging must never break the job itself — every DB call here is
 * fail-soft: on error we console.error and continue.
 */

export type RunStatus = "running" | "success" | "partial" | "failed";

export interface SystemRun {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  items_processed: number;
  error: string | null;
  details: Record<string, unknown>;
}

export interface RunHandle {
  runId: string;
  addItems: (n: number) => void;
  setDetail: (key: string, value: unknown) => void;
}

export interface RunResult<T> {
  ok: boolean;
  error?: string;
  value?: T;
}

export async function startRun(jobName: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("system_runs")
      .insert({ job_name: jobName, status: "running" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  } catch (err) {
    console.error(`run-logger: failed to start run for ${jobName}`, err);
    return "";
  }
}

export async function finishRun(
  runId: string,
  outcome: {
    status: RunStatus;
    itemsProcessed?: number;
    error?: string | null;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  if (!runId) return;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("system_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: outcome.status,
        items_processed: outcome.itemsProcessed ?? 0,
        error: outcome.error ?? null,
        details: outcome.details ?? {},
      })
      .eq("id", runId);
    if (error) throw error;
  } catch (err) {
    console.error(`run-logger: failed to finish run ${runId}`, err);
  }
}

/**
 * Wraps a job body with start/finish logging. The wrapper never throws:
 * a failing job is recorded as `failed` and returned as { ok: false }.
 */
export async function withRunLog<T>(
  jobName: string,
  fn: (log: RunHandle) => Promise<T>
): Promise<RunResult<T>> {
  const runId = await startRun(jobName);
  let items = 0;
  const details: Record<string, unknown> = {};
  const handle: RunHandle = {
    runId,
    addItems: (n) => {
      items += n;
    },
    setDetail: (key, value) => {
      details[key] = value;
    },
  };

  try {
    const value = await fn(handle);
    await finishRun(runId, { status: "success", itemsProcessed: items, details });
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`run-logger: job ${jobName} failed`, err);
    await finishRun(runId, {
      status: "failed",
      itemsProcessed: items,
      error: message,
      details,
    });
    return { ok: false, error: message };
  }
}

/** Most recent run per job name (for the system health view). */
export async function getLastRunPerJob(): Promise<SystemRun[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("system_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const seen = new Set<string>();
    const latest: SystemRun[] = [];
    for (const run of (data || []) as SystemRun[]) {
      if (!seen.has(run.job_name)) {
        seen.add(run.job_name);
        latest.push(run);
      }
    }
    return latest;
  } catch (err) {
    console.error("run-logger: getLastRunPerJob failed", err);
    return [];
  }
}

export async function getRecentRuns(limit = 50): Promise<SystemRun[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("system_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as SystemRun[];
  } catch (err) {
    console.error("run-logger: getRecentRuns failed", err);
    return [];
  }
}
