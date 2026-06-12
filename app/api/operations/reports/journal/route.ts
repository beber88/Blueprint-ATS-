import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

interface JournalItem {
  id: string;
  issue: string;
  status: string;
  priority: string;
  category: string | null;
  deadline: string | null;
  deadline_raw: string | null;
  ceo_decision_needed: boolean;
  missing_information: string | null;
  next_action: string | null;
  person: string | null;
  project: string;
}

interface JournalReport {
  id: string;
  report_date: string;
  created_at: string;
  source_type: string;
  processing_status: string;
  processing_error: string | null;
  sender: string | null;
  subject: string | null;
  summary: string | null;
  confidence: number | null;
  attachment_filename: string | null;
  items_count: number;
  ceo_items: JournalItem[];
  projects: { name: string; items: JournalItem[] }[];
}

/**
 * GET /api/operations/reports/journal?days=7
 * Daily-journal view: reports grouped by day, each with its extracted
 * items grouped by project and CEO-decision items pinned separately.
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "7"), 1), 60);
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const supabase = createAdminClient();

  const { data: reports, error } = await supabase
    .from("op_reports")
    .select(
      "id, report_date, created_at, source_type, processing_status, processing_error, source_meta, employee:op_employees(full_name)"
    )
    .gte("report_date", since)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reportIds = (reports || []).map((r) => r.id);
  let itemsByReport = new Map<string, JournalItem[]>();

  if (reportIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from("op_report_items")
      .select(
        "id, report_id, issue, status, priority, category, deadline, deadline_raw, ceo_decision_needed, missing_information, next_action, person_responsible_raw, project_raw, project:op_projects(name)"
      )
      .in("report_id", reportIds)
      .limit(3000);

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

    itemsByReport = new Map();
    for (const it of items || []) {
      const proj = it.project as { name: string } | { name: string }[] | null;
      const projName = Array.isArray(proj) ? proj[0]?.name : proj?.name;
      const journalItem: JournalItem = {
        id: it.id,
        issue: it.issue,
        status: it.status,
        priority: it.priority,
        category: it.category,
        deadline: it.deadline,
        deadline_raw: it.deadline_raw,
        ceo_decision_needed: it.ceo_decision_needed === true,
        missing_information: it.missing_information,
        next_action: it.next_action,
        person: it.person_responsible_raw,
        project: projName || it.project_raw || "",
      };
      const list = itemsByReport.get(it.report_id) || [];
      list.push(journalItem);
      itemsByReport.set(it.report_id, list);
    }
  }

  const journalReports: JournalReport[] = (reports || []).map((r) => {
    const meta = (r.source_meta || {}) as Record<string, unknown>;
    const employee = r.employee as { full_name: string } | { full_name: string }[] | null;
    const employeeName = Array.isArray(employee)
      ? employee[0]?.full_name
      : employee?.full_name;
    const items = itemsByReport.get(r.id) || [];

    const ceoItems = items.filter((i) => i.ceo_decision_needed);
    const regular = items.filter((i) => !i.ceo_decision_needed);

    const byProject = new Map<string, JournalItem[]>();
    for (const it of regular) {
      const key = it.project || "";
      const list = byProject.get(key) || [];
      list.push(it);
      byProject.set(key, list);
    }
    const projects = Array.from(byProject.entries())
      .map(([name, projItems]) => ({ name, items: projItems }))
      .sort((a, b) => b.items.length - a.items.length);

    return {
      id: r.id,
      report_date: r.report_date,
      created_at: r.created_at,
      source_type: r.source_type,
      processing_status: r.processing_status,
      processing_error: r.processing_error,
      sender:
        (typeof meta.from_name === "string" && meta.from_name) ||
        (typeof meta.from_email === "string" && meta.from_email) ||
        employeeName ||
        null,
      subject: typeof meta.subject === "string" ? meta.subject : null,
      summary: typeof meta.notes === "string" ? meta.notes : null,
      confidence:
        typeof meta.claude_confidence === "number" ? meta.claude_confidence : null,
      attachment_filename:
        typeof meta.attachment_filename === "string" ? meta.attachment_filename : null,
      items_count: items.length,
      ceo_items: ceoItems,
      projects,
    };
  });

  // Group by day, newest first
  const byDay = new Map<string, JournalReport[]>();
  for (const r of journalReports) {
    const day = r.report_date;
    const list = byDay.get(day) || [];
    list.push(r);
    byDay.set(day, list);
  }
  const daysList = Array.from(byDay.entries())
    .map(([date, dayReports]) => ({ date, reports: dayReports }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({ days: daysList, since, total_reports: journalReports.length });
}
