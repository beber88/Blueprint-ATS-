import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  // Run all queries in parallel
  const [
    employeesRes,
    leaveRes,
    reviewsRes,
    attendanceRes,
    documentsRes,
    deptRes,
    driveRes,
  ] = await Promise.all([
    // Total employees (active vs inactive)
    supabase.from("op_employees").select("id, is_active, hire_date, department_id, date_of_birth"),
    // Pending leave requests
    supabase.from("hr_leave_requests").select("id").eq("status", "pending"),
    // Overdue reviews (no review in last 6 months)
    supabase.from("hr_performance_reviews").select("id, employee_id, review_date").order("review_date", { ascending: false }),
    // Today's attendance
    supabase.from("hr_attendance").select("id, status").eq("date", today),
    // Employee documents count
    supabase.from("hr_employee_documents").select("id, employee_id, document_type"),
    // Department breakdown
    supabase.from("op_departments").select("id, name, name_he"),
    // Drive sync state
    supabase.from("drive_files").select("classification_status"),
  ]);

  const employees = employeesRes.data || [];
  const active = employees.filter((e) => e.is_active);
  const inactive = employees.filter((e) => !e.is_active);

  // New hires this month
  const newHires = active.filter((e) => e.hire_date && e.hire_date.startsWith(thisMonth));

  // Upcoming birthdays (next 30 days)
  const now = new Date();
  const upcomingBirthdays = active
    .filter((e) => {
      if (!e.date_of_birth) return false;
      const bday = new Date(e.date_of_birth);
      const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
      const diff = (thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    })
    .length;

  // Department distribution
  const deptCounts: Record<string, number> = {};
  const deptNames: Record<string, string> = {};
  for (const d of deptRes.data || []) {
    deptNames[d.id] = d.name_he || d.name;
  }
  for (const e of active) {
    const deptName = e.department_id ? (deptNames[e.department_id] || "Other") : "Unassigned";
    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
  }

  // Documents per employee (compliance)
  const docsByEmployee = new Map<string, Set<string>>();
  for (const d of documentsRes.data || []) {
    if (!docsByEmployee.has(d.employee_id)) docsByEmployee.set(d.employee_id, new Set());
    docsByEmployee.get(d.employee_id)!.add(d.document_type);
  }
  const withDocs = active.filter((e) => docsByEmployee.has(e.id)).length;
  const compliancePercent = active.length > 0 ? Math.round((withDocs / active.length) * 100) : 0;

  // Drive sync stats
  const driveCounts: Record<string, number> = {};
  for (const f of driveRes.data || []) {
    driveCounts[f.classification_status] = (driveCounts[f.classification_status] || 0) + 1;
  }

  return NextResponse.json({
    employees: {
      total: employees.length,
      active: active.length,
      inactive: inactive.length,
      new_this_month: newHires.length,
      upcoming_birthdays: upcomingBirthdays,
    },
    leave: {
      pending: leaveRes.data?.length || 0,
    },
    reviews: {
      total: reviewsRes.data?.length || 0,
    },
    attendance: {
      today_present: attendanceRes.data?.filter((a) => a.status === "present").length || 0,
      today_total: attendanceRes.data?.length || 0,
    },
    compliance: {
      with_documents: withDocs,
      total_active: active.length,
      percent: compliancePercent,
    },
    departments: deptCounts,
    drive: driveCounts,
  });
}
