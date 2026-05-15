import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeProfileSummary, SalarySchedule } from "./types";

// Read-side glue for the employee-profile UI. Returns one row of
// counts/pointers per tab so the page can render section headers
// without hitting every detail endpoint upfront.
export async function getEmployeeProfileSummary(
  supabase: SupabaseClient,
  employeeId: string
): Promise<EmployeeProfileSummary> {
  const [
    activeContract,
    pendingSchedule,
    openDiscipline,
    recognitions,
    expiringCompliance,
    unresolvedAlerts,
    benefits,
    notes,
  ] = await Promise.all([
    supabase
      .from("hr_employment_contracts")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("hr_salary_schedules")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("status", "pending")
      .maybeSingle(),
    supabase
      .from("hr_disciplinary_records")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("status", "open"),
    supabase
      .from("hr_recognitions")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId),
    supabase
      .from("hr_compliance_records")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .in("status", ["expired", "renewing"]),
    supabase
      .from("hr_alerts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .is("resolved_at", null),
    supabase
      .from("hr_benefits")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId),
    supabase
      .from("hr_employee_notes")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId),
  ]);

  return {
    employee_id: employeeId,
    active_contract_id: (activeContract.data?.id as string | undefined) ?? null,
    pending_salary_schedule: (pendingSchedule.data as SalarySchedule | null) ?? null,
    open_disciplinary_count: openDiscipline.count ?? 0,
    recognitions_count: recognitions.count ?? 0,
    expiring_compliance_count: expiringCompliance.count ?? 0,
    unresolved_alerts_count: unresolvedAlerts.count ?? 0,
    benefits_count: benefits.count ?? 0,
    notes_count: notes.count ?? 0,
  };
}
