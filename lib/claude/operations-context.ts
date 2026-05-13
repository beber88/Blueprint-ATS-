import { createAdminClient } from "@/lib/supabase/admin";

// Builds a compact context bundle the Operations AI Agent uses for grounding.
// Mirrors the recruitment ai-agent context-building approach but scoped to ops data.

export async function buildOperationsContext() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { data: items },
    { data: alerts },
    { data: reports },
    { data: projects },
    { data: departments },
    { data: employees },
    { data: themes },
    { data: missing },
  ] = await Promise.all([
    supabase
      .from("op_report_items")
      .select("*, department:op_departments(name, name_he), project:op_projects(name), employee:op_employees(full_name)")
      .gte("report_date", thirtyDaysAgo)
      .order("report_date", { ascending: false })
      .limit(500),
    supabase.from("op_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("op_reports").select("id, report_date, source_type, processing_status").gte("report_date", sevenDaysAgo).order("report_date", { ascending: false }),
    supabase.from("op_projects").select("id, name, status, code"),
    supabase.from("op_departments").select("id, name, name_he, code"),
    supabase.from("op_employees").select("id, full_name, role, department_id, project_id, is_pm").eq("is_active", true),
    supabase.from("op_recurring_themes").select("*").order("occurrence_count", { ascending: false }).limit(20),
    supabase.from("op_missing_reports_v").select("*"),
  ]);

  const rows = items || [];
  const open = rows.filter((r) => r.status !== "resolved");
  const overdue = open.filter((r) => r.deadline && r.deadline < today);
  const urgent = open.filter((r) => r.priority === "urgent");
  const ceoPending = open.filter((r) => r.ceo_decision_needed);

  const lines: string[] = [];
  lines.push(`SYSTEM SNAPSHOT (as of ${new Date().toISOString()})`);
  lines.push(`- Open items: ${open.length}  Overdue: ${overdue.length}  Urgent: ${urgent.length}  CEO-pending: ${ceoPending.length}`);
  lines.push(`- Active alerts: ${(alerts || []).length}`);
  lines.push(`- Reports last 7 days: ${(reports || []).length}`);
  lines.push("");

  lines.push("DEPARTMENTS:");
  for (const d of departments || []) {
    lines.push(`- ${d.name} (${d.code})`);
  }
  lines.push("");

  lines.push("PROJECTS:");
  for (const p of projects || []) {
    lines.push(`- ${p.name}${p.code ? ` [${p.code}]` : ""} — status ${p.status}`);
  }
  lines.push("");

  lines.push(`PMs / EMPLOYEES (${(employees || []).length}):`);
  for (const e of (employees || []).slice(0, 60)) {
    lines.push(`- ${e.full_name}${e.role ? ` (${e.role})` : ""}${e.is_pm ? " [PM]" : ""}`);
  }
  lines.push("");

  if ((missing || []).length > 0) {
    lines.push("PROJECTS WITHOUT YESTERDAY'S REPORT:");
    for (const m of missing || []) lines.push(`- ${m.project_name}`);
    lines.push("");
  }

  if ((alerts || []).length > 0) {
    lines.push("OPEN ALERTS:");
    for (const a of (alerts || []).slice(0, 30)) {
      lines.push(`- [${a.type} / ${a.severity}] ${a.message}`);
    }
    lines.push("");
  }

  if ((themes || []).length > 0) {
    lines.push("RECURRING THEMES (last 30 days):");
    for (const t of themes || []) {
      lines.push(`- ${t.theme} (${t.occurrence_count}× last seen ${t.last_seen_at?.slice(0, 10) || "?"})`);
    }
    lines.push("");
  }

  lines.push(`OPEN ITEMS (${open.length}):`);
  for (const r of open.slice(0, 200)) {
    const dept = (r.department as { name?: string } | null)?.name || r.department_raw || "?";
    const proj = (r.project as { name?: string } | null)?.name || r.project_raw || "?";
    const emp = (r.employee as { full_name?: string } | null)?.full_name || r.person_responsible_raw || "?";
    const dl = r.deadline ? `due ${r.deadline}` : "no deadline";
    const flags = [
      r.priority === "urgent" ? "URGENT" : "",
      r.ceo_decision_needed ? "CEO" : "",
      r.missing_information ? "MISSING-INFO" : "",
      r.deadline && r.deadline < today ? "OVERDUE" : "",
    ].filter(Boolean).join(" ");
    lines.push(`- [${r.report_date}] (${dept}/${proj}) ${emp}: ${r.issue} — ${r.status}/${r.priority} ${dl} ${flags}`);
    if (r.next_action) lines.push(`    next: ${r.next_action}`);
    if (r.missing_information) lines.push(`    missing: ${r.missing_information}`);
  }

  return {
    text: lines.join("\n"),
    counts: {
      open: open.length,
      overdue: overdue.length,
      urgent: urgent.length,
      ceo_pending: ceoPending.length,
      alerts: (alerts || []).length,
    },
  };
}
