import { createAdminClient } from "@/lib/supabase/admin";

// Server-side query helpers shared across dashboards, stats, AI context, and crons.

export async function getOperationsStats() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { data: items },
    { data: alerts },
    { data: reports },
    { data: projects },
    { data: departments },
    { data: themes },
  ] = await Promise.all([
    supabase
      .from("op_report_items")
      .select("id, status, priority, ceo_decision_needed, missing_information, deadline, category, department_id, project_id, report_date, created_at, issue")
      .gte("report_date", sevenDaysAgo)
      .order("report_date", { ascending: false })
      .limit(2000),
    supabase.from("op_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(200),
    supabase.from("op_reports").select("id, report_date, source_type, processing_status, created_at").order("report_date", { ascending: false }).limit(60),
    supabase.from("op_projects").select("id, name, status, department_id").order("name"),
    supabase.from("op_departments").select("id, code, name, name_he, name_en, name_tl, color"),
    supabase.from("op_recurring_themes").select("*").order("occurrence_count", { ascending: false }).limit(10),
  ]);

  const rows = items || [];
  const open = rows.filter((r) => r.status !== "resolved");
  const overdue = open.filter((r) => r.deadline && r.deadline < today);
  const urgent = open.filter((r) => r.priority === "urgent");
  const ceoPending = open.filter((r) => r.ceo_decision_needed);
  const missingInfo = open.filter((r) => r.missing_information && r.missing_information.trim().length > 0);

  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  const byPriority: Record<string, number> = {};
  for (const r of open) byPriority[r.priority] = (byPriority[r.priority] || 0) + 1;

  const byCategory: Record<string, number> = {};
  for (const r of open) byCategory[r.category] = (byCategory[r.category] || 0) + 1;

  const byDepartment: Record<string, number> = {};
  for (const r of open) if (r.department_id) byDepartment[r.department_id] = (byDepartment[r.department_id] || 0) + 1;

  const byProject: Record<string, number> = {};
  for (const r of open) if (r.project_id) byProject[r.project_id] = (byProject[r.project_id] || 0) + 1;

  // Daily trend (last 14 days)
  const dailyTrend: { date: string; total: number; overdue: number; urgent: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dayItems = rows.filter((r) => r.report_date === d);
    dailyTrend.push({
      date: d,
      total: dayItems.length,
      overdue: dayItems.filter((r) => r.deadline && r.deadline < today && r.status !== "resolved").length,
      urgent: dayItems.filter((r) => r.priority === "urgent").length,
    });
  }

  return {
    kpis: {
      open: open.length,
      overdue: overdue.length,
      urgent: urgent.length,
      ceo_pending: ceoPending.length,
      missing_info: missingInfo.length,
      alerts: (alerts || []).length,
    },
    breakdown: { byStatus, byPriority, byCategory, byDepartment, byProject },
    dailyTrend,
    projects: projects || [],
    departments: departments || [],
    alerts: (alerts || []).slice(0, 20),
    reports: reports || [],
    recurringThemes: themes || [],
  };
}

export async function getRecentItems(limit = 50) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("op_report_items")
    .select("*, department:op_departments(name, name_he, name_en, color), project:op_projects(name), employee:op_employees(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getOpenAlerts(limit = 50) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("op_alerts")
    .select("*, item:op_report_items(id, issue, priority, deadline, department_id, project_id)")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}
