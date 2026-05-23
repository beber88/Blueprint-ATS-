import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalarySchedule } from "./types";

// Applies a pending salary schedule:
//   1. Read the schedule (must be status='pending').
//   2. Insert a new hr_salary row at the scheduled date with the
//      expected amount.
//   3. Flip the schedule to status='applied' and record the new
//      salary row's id + applied_at.
//
// The two writes are sequenced (Supabase JS doesn't expose a single
// transaction primitive for arbitrary statements); the schedule
// update only fires after the salary insert succeeds, so a mid-flight
// failure leaves the schedule still 'pending' — safe to retry.
//
// Throws on any DB error or when the schedule isn't found / isn't
// pending. The cron and the API route both call this; the cron
// swallows per-employee errors so one bad schedule doesn't abort
// the rest of the run.
export async function applySalarySchedule(
  supabase: SupabaseClient,
  scheduleId: string,
  appliedByUserId: string | null = null
): Promise<{ scheduleId: string; salaryId: string }> {
  const { data: schedule, error: fetchErr } = await supabase
    .from("hr_salary_schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to load salary schedule: ${fetchErr.message}`);
  }
  if (!schedule) {
    throw new Error(`Salary schedule ${scheduleId} not found`);
  }

  const s = schedule as SalarySchedule;
  if (s.status !== "pending") {
    throw new Error(
      `Salary schedule ${scheduleId} is not pending (status=${s.status})`
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("hr_salary")
    .insert({
      employee_id: s.employee_id,
      effective_date: s.scheduled_date,
      base_salary: s.expected_amount,
      currency: s.currency ?? "PHP",
      notes: s.reason ?? `Applied from schedule ${s.id}`,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    throw new Error(
      `Failed to insert hr_salary row for schedule ${scheduleId}: ${insertErr?.message ?? "unknown error"}`
    );
  }

  const salaryId = inserted.id as string;
  const nowIso = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("hr_salary_schedules")
    .update({
      status: "applied",
      applied_at: nowIso,
      applied_salary_id: salaryId,
      ...(appliedByUserId ? { created_by: s.created_by ?? appliedByUserId } : {}),
    })
    .eq("id", scheduleId)
    .eq("status", "pending"); // guard against double-apply

  if (updateErr) {
    throw new Error(
      `Salary inserted but schedule status update failed for ${scheduleId}: ${updateErr.message}`
    );
  }

  return { scheduleId, salaryId };
}

// Cancels a pending schedule. No-op if it's already applied/cancelled.
export async function cancelSalarySchedule(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<void> {
  const { error } = await supabase
    .from("hr_salary_schedules")
    .update({ status: "cancelled" })
    .eq("id", scheduleId)
    .eq("status", "pending");
  if (error) {
    throw new Error(`Failed to cancel salary schedule: ${error.message}`);
  }
}
