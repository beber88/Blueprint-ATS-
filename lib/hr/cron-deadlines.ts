import type { SupabaseClient } from "@supabase/supabase-js";
import type { HrAlertSeverity, HrAlertType } from "./types";

// Pure types — extracted so the planner logic can be unit-tested
// without standing up a DB.

export interface ComplianceRow {
  employee_id: string;
  expiry_date: string | null;
  status: string;
}

export interface SalaryScheduleRow {
  employee_id: string;
  scheduled_date: string;
  status: string;
}

export interface EmploymentContractRow {
  employee_id: string;
  end_date: string | null;
  status: string;
  start_date: string;
  probation_period_days: number | null;
}

export interface DocumentRow {
  employee_id: string;
  expiry_date: string | null;
}

export interface PlannedAlert {
  employee_id: string;
  type: HrAlertType;
  severity: HrAlertSeverity;
  message: string;
  // Side-effect: flip compliance status to 'expired' when we emit
  // a compliance_expired alert. Carried with the planned alert so
  // the caller can issue both writes in one pass.
  flipComplianceToExpired?: { compliance_id?: string };
}

const DAY = 24 * 60 * 60 * 1000;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Pure planner. Given today's date and snapshots of the relevant
// tables, returns the alerts that should exist. The cron handler is
// the only place that turns these into INSERTs (idempotency comes
// from the partial unique index on hr_alerts).
export function planEmployeeDeadlineAlerts(input: {
  today: Date;
  compliance: Array<ComplianceRow & { id?: string }>;
  schedules: SalaryScheduleRow[];
  contracts: EmploymentContractRow[];
  documents: DocumentRow[];
}): PlannedAlert[] {
  const { today, compliance, schedules, contracts, documents } = input;
  const todayIso = toIsoDate(today);
  const in14Iso = toIsoDate(new Date(today.getTime() + 14 * DAY));
  const in30Iso = toIsoDate(new Date(today.getTime() + 30 * DAY));

  const planned: PlannedAlert[] = [];

  // 1. compliance_expired: expiry_date < today AND status='valid'
  for (const c of compliance) {
    if (!c.expiry_date) continue;
    if (c.expiry_date < todayIso && c.status === "valid") {
      planned.push({
        employee_id: c.employee_id,
        type: "compliance_expired",
        severity: "high",
        message: `Compliance record expired on ${c.expiry_date}`,
        flipComplianceToExpired: { compliance_id: c.id },
      });
    }
  }

  // 2. compliance_expiring: expiry_date in [today, today+30]
  for (const c of compliance) {
    if (!c.expiry_date) continue;
    if (
      c.expiry_date >= todayIso &&
      c.expiry_date <= in30Iso &&
      c.status === "valid"
    ) {
      planned.push({
        employee_id: c.employee_id,
        type: "compliance_expiring",
        severity: "medium",
        message: `Compliance record expires on ${c.expiry_date}`,
      });
    }
  }

  // 3. salary_increase_due: scheduled_date <= today AND status='pending'
  for (const s of schedules) {
    if (s.status !== "pending") continue;
    if (s.scheduled_date <= todayIso) {
      planned.push({
        employee_id: s.employee_id,
        type: "salary_increase_due",
        severity: "medium",
        message: `Scheduled salary increase due on ${s.scheduled_date}`,
      });
    }
  }

  // 4. contract_expiring: end_date in [today, today+30] AND status='active'
  for (const ec of contracts) {
    if (!ec.end_date || ec.status !== "active") continue;
    if (ec.end_date >= todayIso && ec.end_date <= in30Iso) {
      planned.push({
        employee_id: ec.employee_id,
        type: "contract_expiring",
        severity: "medium",
        message: `Employment contract ends on ${ec.end_date}`,
      });
    }
  }

  // 5. probation_ending: probation_period_days set, and
  //    start_date + probation_period_days falls in [today, today+14].
  for (const ec of contracts) {
    if (ec.status !== "active" || !ec.probation_period_days) continue;
    const probationEnd = new Date(ec.start_date);
    probationEnd.setUTCDate(probationEnd.getUTCDate() + ec.probation_period_days);
    const peIso = toIsoDate(probationEnd);
    if (peIso >= todayIso && peIso <= in14Iso) {
      planned.push({
        employee_id: ec.employee_id,
        type: "probation_ending",
        severity: "medium",
        message: `Probation period ends on ${peIso}`,
      });
    }
  }

  // 6. document_expiring: expiry_date in [today, today+30]
  for (const d of documents) {
    if (!d.expiry_date) continue;
    if (d.expiry_date >= todayIso && d.expiry_date <= in30Iso) {
      planned.push({
        employee_id: d.employee_id,
        type: "document_expiring",
        severity: "low",
        message: `Document expires on ${d.expiry_date}`,
      });
    }
  }

  return planned;
}

// Side-effecting wrapper — used by the cron route. Inserts every
// planned alert with ON CONFLICT DO NOTHING (the partial unique on
// (employee_id, type) WHERE resolved_at IS NULL makes the cron
// idempotent), and flips compliance rows to status='expired' as
// noted. Returns the actual insert count from upserts (note: the
// "DO NOTHING" branches don't count as inserted, so this is the
// number of NEW alerts created on this run).
export async function runEmployeeDeadlineScan(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<{
  alertsPlanned: number;
  alertsCreated: number;
  complianceFlipped: number;
}> {
  const [complianceRes, schedulesRes, contractsRes, documentsRes] = await Promise.all([
    supabase
      .from("hr_compliance_records")
      .select("id, employee_id, expiry_date, status"),
    supabase
      .from("hr_salary_schedules")
      .select("employee_id, scheduled_date, status"),
    supabase
      .from("hr_employment_contracts")
      .select("employee_id, end_date, status, start_date, probation_period_days"),
    supabase
      .from("hr_employee_documents")
      .select("employee_id, expiry_date"),
  ]);

  const planned = planEmployeeDeadlineAlerts({
    today: now,
    compliance: (complianceRes.data ?? []) as Array<ComplianceRow & { id: string }>,
    schedules: (schedulesRes.data ?? []) as SalaryScheduleRow[],
    contracts: (contractsRes.data ?? []) as EmploymentContractRow[],
    documents: (documentsRes.data ?? []) as DocumentRow[],
  });

  let complianceFlipped = 0;
  const complianceIdsToFlip = new Set<string>();
  for (const p of planned) {
    if (p.type === "compliance_expired" && p.flipComplianceToExpired?.compliance_id) {
      complianceIdsToFlip.add(p.flipComplianceToExpired.compliance_id);
    }
  }
  if (complianceIdsToFlip.size > 0) {
    const { data: flipped } = await supabase
      .from("hr_compliance_records")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("id", Array.from(complianceIdsToFlip))
      .eq("status", "valid")
      .select("id");
    complianceFlipped = (flipped ?? []).length;
  }

  let alertsCreated = 0;
  for (const p of planned) {
    // Pre-check for an open alert with the same (employee_id, type).
    // We don't have a synthetic CONFLICT target in supabase-js for
    // partial unique indexes, so check-then-insert. Race conditions
    // are tolerable: the index will reject duplicate inserts.
    const { data: existing } = await supabase
      .from("hr_alerts")
      .select("id")
      .eq("employee_id", p.employee_id)
      .eq("type", p.type)
      .is("resolved_at", null)
      .maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("hr_alerts").insert({
      employee_id: p.employee_id,
      type: p.type,
      severity: p.severity,
      message: p.message,
    });
    if (!error) alertsCreated += 1;
  }

  return {
    alertsPlanned: planned.length,
    alertsCreated,
    complianceFlipped,
  };
}
