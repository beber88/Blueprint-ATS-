import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractReportItems } from "@/lib/claude/extract-report";
import {
  matchDepartmentByName,
  matchEmployeeByName,
  matchProjectByName,
} from "@/lib/operations/match-employee";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Splits a long pasted text containing multiple daily reports into per-report
// chunks and ingests each as its own op_reports row + items.
//
// Heuristic: each report begins with a header line containing "Date:" or
// "תאריך:" or a markdown horizontal rule (---) followed by a date. We split on
// these boundaries. Each chunk is sent to Claude for extraction.
//
// Body: { text: string, defaultProjectId?: string }
// Response: { reports: [{ id, report_date, items_count }], total_items: number }

interface BulkBody {
  text: string;
  defaultProjectId?: string;
}

function parseDateFromHeader(header: string): string | null {
  const m = header.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const m2 = header.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m2) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
      july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
    };
    return `${m2[3]}-${months[m2[1].toLowerCase()]}-${m2[2].padStart(2, "0")}`;
  }
  return null;
}

function splitReports(text: string): Array<{ chunk: string; date: string | null }> {
  const lines = text.split("\n");
  const reports: Array<{ chunk: string; date: string | null }> = [];
  let current: string[] = [];
  let currentDate: string | null = null;

  const isReportHeader = (i: number): { match: boolean; date: string | null } => {
    const line = lines[i] || "";
    const m = line.match(/^\s*(?:date|תאריך)\s*[:\-]\s*(.+)$/i);
    if (m) return { match: true, date: parseDateFromHeader(m[1]) };
    return { match: false, date: null };
  };

  for (let i = 0; i < lines.length; i++) {
    const header = isReportHeader(i);
    if (header.match && current.length > 0) {
      reports.push({ chunk: current.join("\n").trim(), date: currentDate });
      current = [];
    }
    if (header.match) currentDate = header.date;
    current.push(lines[i]);
  }
  if (current.length > 0) {
    reports.push({ chunk: current.join("\n").trim(), date: currentDate });
  }
  return reports.filter((r) => r.chunk.length > 100);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }
    const body = (await request.json()) as BulkBody;
    if (!body.text || body.text.trim().length < 100) {
      return NextResponse.json({ error: "text required (min 100 chars)" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const chunks = splitReports(body.text);
    if (chunks.length === 0) {
      return NextResponse.json({
        error: "Could not detect any report headers. Reports must contain a 'Date: YYYY-MM-DD' or 'תאריך: ...' line.",
      }, { status: 400 });
    }

    const created: Array<{ id: string; report_date: string; items_count: number }> = [];
    let totalItems = 0;

    for (const c of chunks) {
      const reportDate = c.date || new Date().toISOString().slice(0, 10);

      const { data: report, error: insErr } = await supabase
        .from("op_reports")
        .insert({
          source_type: "text",
          raw_text: c.chunk.slice(0, 200000),
          source_meta: { bulk_import: true },
          report_date: reportDate,
          processing_status: "processing",
        })
        .select()
        .single();

      if (insErr || !report) {
        console.error("bulk-ingest: insert failed", insErr);
        continue;
      }

      try {
        const extracted = await extractReportItems(c.chunk, { reportDate });
        const itemRows: Record<string, unknown>[] = [];
        for (const it of extracted.items) {
          const empMatch = await matchEmployeeByName(supabase, it.person_responsible);
          const deptId = await matchDepartmentByName(supabase, it.department);
          const projId = (await matchProjectByName(supabase, it.project)) || body.defaultProjectId || null;
          itemRows.push({
            report_id: report.id,
            report_date: reportDate,
            department_id: deptId,
            department_raw: it.department,
            project_id: projId,
            project_raw: it.project,
            person_responsible_id: empMatch.employee_id,
            person_responsible_raw: it.person_responsible,
            person_responsible_match_confidence: empMatch.confidence || null,
            issue: it.issue,
            status: it.status,
            deadline: it.deadline,
            deadline_raw: it.deadline_raw,
            deadline_uncertain: it.deadline_uncertain,
            missing_information: it.missing_information,
            ceo_decision_needed: it.ceo_decision_needed,
            priority: it.priority,
            next_action: it.next_action,
            category: it.category,
          });
        }
        if (itemRows.length > 0) {
          await supabase.from("op_report_items").insert(itemRows);
        }
        await supabase
          .from("op_reports")
          .update({
            processing_status: "completed",
            processed_at: new Date().toISOString(),
            source_meta: { bulk_import: true, claude_confidence: extracted.confidence, claude_model: extracted.model, notes: extracted.notes },
          })
          .eq("id", report.id);
        created.push({ id: report.id, report_date: reportDate, items_count: itemRows.length });
        totalItems += itemRows.length;
      } catch (e) {
        console.error("bulk-ingest: extraction failed for chunk", e);
        await supabase
          .from("op_reports")
          .update({
            processing_status: "failed",
            processing_error: e instanceof Error ? e.message : String(e),
            processed_at: new Date().toISOString(),
          })
          .eq("id", report.id);
      }
    }

    return NextResponse.json({
      reports: created,
      total_items: totalItems,
      chunks_detected: chunks.length,
    });
  } catch (error) {
    console.error("bulk-ingest: unhandled", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk ingest failed" },
      { status: 500 }
    );
  }
}
