"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OpsPageShell } from "@/components/operations/page-shell";
import { SystemHealthStrip } from "@/components/operations/system-health-strip";
import { useI18n } from "@/lib/i18n/context";
import {
  Mail,
  FileText,
  MessageCircle,
  Image as ImageIcon,
  Loader2,
  Crown,
  RefreshCw,
  Brain,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

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

interface JournalDay {
  date: string;
  reports: JournalReport[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#A32D2D",
  high: "#B4690E",
  medium: "#1A56A8",
  low: "#6B6356",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#1A56A8",
  in_progress: "#B4690E",
  blocked: "#A32D2D",
  resolved: "#2D7A3E",
};

const SOURCE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  pdf: FileText,
  text: FileText,
  whatsapp: MessageCircle,
  image: ImageIcon,
};

export default function DailyJournalPage() {
  const { t, locale } = useI18n();
  const [days, setDays] = useState<JournalDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(7);
  const [pendingQuestions, setPendingQuestions] = useState(0);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadJournal = useCallback(() => {
    setLoading(true);
    fetch(`/api/operations/reports/journal?days=${rangeDays}`)
      .then((r) => r.json())
      .then((d) => setDays(d.days || []))
      .finally(() => setLoading(false));
  }, [rangeDays]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  useEffect(() => {
    fetch("/api/operations/context/questions?status=pending")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPendingQuestions(d?.questions?.length ?? d?.count ?? 0))
      .catch(() => {});
  }, []);

  const reprocess = async (reportId: string) => {
    setReprocessing(reportId);
    try {
      await fetch("/api/operations/reports/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId }),
      });
      loadJournal();
    } finally {
      setReprocessing(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDay = (d: string) => {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString(
        locale === "he" ? "he-IL" : locale === "tl" ? "fil-PH" : "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" }
      );
    } catch {
      return d;
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <OpsPageShell
      title={t("operations.journal.title")}
      subtitle={t("operations.journal.subtitle")}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/hr/operations/knowledge" style={badgeLink}>
            <Brain size={14} />
            {t("operations.journal.brain_questions_badge")}
            {pendingQuestions > 0 && (
              <span style={countBadge}>{pendingQuestions}</span>
            )}
          </Link>
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(parseInt(e.target.value))}
            style={selectStyle}
          >
            <option value={7}>{t("operations.journal.range_week")}</option>
            <option value={14}>{t("operations.journal.range_two_weeks")}</option>
            <option value={30}>{t("operations.journal.range_month")}</option>
          </select>
        </div>
      }
    >
      <SystemHealthStrip />

      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : days.length === 0 ? (
        <div style={emptyState}>
          <FileText size={32} style={{ color: "var(--text-tertiary)", marginBottom: 8 }} />
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            {t("operations.journal.no_reports")}
          </p>
        </div>
      ) : (
        days.map((day) => (
          <section key={day.date} style={{ marginBottom: 28 }}>
            <h2 style={dayHeading}>
              {formatDay(day.date)}
              {day.date === today && (
                <span style={todayBadge}>{t("operations.journal.today")}</span>
              )}
            </h2>
            {day.reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                expanded={expanded.has(report.id)}
                onToggle={() => toggleExpand(report.id)}
                onReprocess={() => reprocess(report.id)}
                reprocessing={reprocessing === report.id}
                t={t}
              />
            ))}
          </section>
        ))
      )}
    </OpsPageShell>
  );
}

function ReportCard({
  report,
  expanded,
  onToggle,
  onReprocess,
  reprocessing,
  t,
}: {
  report: JournalReport;
  expanded: boolean;
  onToggle: () => void;
  onReprocess: () => void;
  reprocessing: boolean;
  t: (key: string) => string;
}) {
  const SourceIcon = SOURCE_ICONS[report.source_type] || FileText;
  const isPending =
    report.processing_status === "queued" || report.processing_status === "processing";
  const isFailed = report.processing_status === "failed";

  // Compact status row for unprocessed/failed reports
  if (isPending || isFailed) {
    return (
      <div style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SourceIcon size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {report.sender || report.subject || report.source_type}
        </span>
        {isFailed ? (
          <span style={{ ...chip, background: "rgba(163,45,45,0.12)", color: "#A32D2D" }}>
            <AlertCircle size={11} style={{ marginInlineEnd: 3 }} />
            {t("operations.journal.processing_failed")}
          </span>
        ) : (
          <span style={{ ...chip, background: "rgba(138,125,107,0.15)", color: "var(--text-secondary)" }}>
            {t("operations.journal.pending_processing")}
          </span>
        )}
        {isFailed && report.processing_error && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {report.processing_error.slice(0, 120)}
          </span>
        )}
        <button onClick={onReprocess} disabled={reprocessing} style={reprocessBtn}>
          {reprocessing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {t("operations.journal.reprocess")}
        </button>
      </div>
    );
  }

  const visibleProjects = expanded ? report.projects : report.projects.slice(0, 3);
  const hiddenCount = report.projects.length - visibleProjects.length;

  return (
    <div style={cardStyle}>
      {/* Header: sender + source + items count + link */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <SourceIcon size={15} style={{ color: "#C9A84C", flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {report.sender || t("operations.journal.unknown_sender")}
        </span>
        {report.attachment_filename && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            📎 {report.attachment_filename}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {report.items_count} {t("operations.journal.items_count")}
        </span>
        <div style={{ marginInlineStart: "auto" }}>
          <Link href={`/hr/operations/reports/${report.id}`} style={viewLink}>
            {t("operations.journal.view_report")} ←
          </Link>
        </div>
      </div>

      {/* AI summary */}
      {report.summary && (
        <p style={summaryStyle}>{report.summary}</p>
      )}

      {/* CEO decision items — pinned on top */}
      {report.ceo_items.length > 0 && (
        <div style={ceoBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Crown size={13} style={{ color: "#A32D2D" }} />
            <span style={{ fontWeight: 700, fontSize: 12, color: "#A32D2D" }}>
              {t("operations.journal.ceo_needed")} ({report.ceo_items.length})
            </span>
          </div>
          {report.ceo_items.map((item) => (
            <ItemRow key={item.id} item={item} showProject t={t} />
          ))}
        </div>
      )}

      {/* Items grouped by project */}
      {visibleProjects.map((proj) => (
        <div key={proj.name || "general"} style={{ marginTop: 10 }}>
          <div style={projectHeading}>
            {proj.name || t("operations.journal.general_items")}
            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontSize: 11 }}>
              {" "}· {proj.items.length}
            </span>
          </div>
          {proj.items.map((item) => (
            <ItemRow key={item.id} item={item} t={t} />
          ))}
        </div>
      ))}

      {report.projects.length > 3 && (
        <button onClick={onToggle} style={expandBtn}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded
            ? t("operations.journal.show_less")
            : `${t("operations.journal.show_more")} (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}

function ItemRow({
  item,
  showProject,
  t,
}: {
  item: JournalItem;
  showProject?: boolean;
  t: (key: string) => string;
}) {
  const statusColor = STATUS_COLORS[item.status] || "#6B6356";
  const priorityColor = PRIORITY_COLORS[item.priority] || "#6B6356";

  return (
    <div style={itemRowStyle}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: statusColor,
          flexShrink: 0,
          marginTop: 6,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13 }}>{item.issue}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
          {showProject && item.project && (
            <span style={{ ...miniChip, background: "rgba(201,168,76,0.15)", color: "#8a6d1f" }}>
              {item.project}
            </span>
          )}
          {(item.priority === "urgent" || item.priority === "high") && (
            <span style={{ ...miniChip, background: priorityColor + "18", color: priorityColor }}>
              {t(`operations.journal.priority_${item.priority}`)}
            </span>
          )}
          {item.person && (
            <span style={{ ...miniChip, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              {item.person}
            </span>
          )}
          {(item.deadline || item.deadline_raw) && (
            <span style={{ ...miniChip, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              ⏰ {item.deadline || item.deadline_raw}
            </span>
          )}
          {item.missing_information && (
            <span style={{ ...miniChip, background: "rgba(180,105,14,0.12)", color: "#B4690E" }}>
              {t("operations.journal.missing_info")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 10,
};

const dayHeading: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text-primary)",
  margin: "0 0 10px 0",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const todayBadge: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  background: "#C9A84C",
  color: "#1A1A1A",
  padding: "2px 8px",
  borderRadius: 10,
};

const summaryStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  background: "var(--bg-secondary)",
  borderRadius: 8,
  padding: "8px 12px",
  margin: "0 0 8px 0",
  lineHeight: 1.5,
};

const ceoBox: React.CSSProperties = {
  border: "1px solid rgba(163,45,45,0.3)",
  background: "rgba(163,45,45,0.05)",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 6,
};

const projectHeading: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: 4,
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "5px 0",
  alignItems: "flex-start",
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 6,
};

const miniChip: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 6px",
  borderRadius: 4,
};

const viewLink: React.CSSProperties = {
  color: "#C9A84C",
  fontWeight: 600,
  fontSize: 12,
  textDecoration: "none",
};

const badgeLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-primary)",
  textDecoration: "none",
  border: "1px solid var(--border-primary)",
  borderRadius: 8,
  padding: "6px 10px",
  background: "var(--bg-card)",
};

const countBadge: React.CSSProperties = {
  background: "#C9A84C",
  color: "#1A1A1A",
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 10,
  padding: "1px 6px",
};

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
};

const reprocessBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  cursor: "pointer",
  marginInlineStart: "auto",
};

const expandBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: "#C9A84C",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "6px 0 0 0",
};

const emptyState: React.CSSProperties = {
  textAlign: "center",
  padding: 48,
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: 12,
};
