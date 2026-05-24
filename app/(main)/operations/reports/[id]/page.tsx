"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "#8A7D6B",
  in_progress: "#1A56A8",
  blocked: "#A32D2D",
  resolved: "#2D7A3E",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#A32D2D",
  high: "#C9A84C",
  medium: "#1A56A8",
  low: "#6B6356",
};

interface ReportItem {
  id: string;
  issue: string;
  status: string;
  priority: string;
  category: string;
  deadline: string | null;
  project_raw: string | null;
  department_raw: string | null;
  person_responsible_raw: string | null;
  ceo_decision_needed: boolean;
  missing_information: string | null;
  next_action: string | null;
  department?: { name: string; name_he?: string; color?: string } | null;
  project?: { name: string } | null;
  employee?: { full_name: string } | null;
}

interface Report {
  id: string;
  report_date: string;
  source_type: string;
  raw_text: string;
  processing_status: string;
  processed_at: string | null;
  source_meta: Record<string, unknown> | null;
  created_at: string;
  employee?: { full_name: string } | null;
}

export default function ReportDetailPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawExpanded, setRawExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/operations/reports/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.report) {
          setReport(d.report);
          setItems(d.items || []);
        } else {
          toast.error(d.error || "Report not found");
        }
      })
      .catch(() => toast.error(t("common.error")))
      .finally(() => setLoading(false));
  }, [id, t]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString(locale === "he" ? "he-IL" : "en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return d; }
  };

  if (loading) {
    return (
      <OpsPageShell title={t("operations.report_detail.title")} backHref="/hr/operations/reports">
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      </OpsPageShell>
    );
  }

  if (!report) {
    return (
      <OpsPageShell title={t("operations.report_detail.title")} backHref="/hr/operations/reports">
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>
          {t("common.not_found") || "Not found"}
        </div>
      </OpsPageShell>
    );
  }

  const confidence = typeof report.source_meta?.claude_confidence === "number"
    ? Math.round((report.source_meta.claude_confidence as number) * 100) + "%"
    : "—";

  return (
    <OpsPageShell
      title={`${t("operations.report_detail.title")} — ${report.report_date}`}
      backHref="/hr/operations/reports"
      actions={
        <Link
          href="/hr/operations/reports"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 6,
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} />
          {t("common.back") || "Back"}
        </Link>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OpsCard title={`${t("operations.report_detail.items_title")} (${items.length})`}>
            {items.length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }}>
                {t("operations.report_detail.no_items")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((it) => (
                  <Link
                    key={it.id}
                    href={`/hr/operations/issues/${it.id}`}
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid var(--border-light)",
                      textDecoration: "none",
                      color: "var(--text-primary)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary, #f8f7f5)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: (STATUS_COLORS[it.status] || "#8A7D6B") + "20",
                        color: STATUS_COLORS[it.status] || "#8A7D6B",
                        fontWeight: 600,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}>
                        {t(`operations.status.${it.status}`)}
                      </span>
                      <span style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: (PRIORITY_COLORS[it.priority] || "#6B6356") + "20",
                        color: PRIORITY_COLORS[it.priority] || "#6B6356",
                        fontWeight: 600,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}>
                        {t(`operations.priority.${it.priority}`)}
                      </span>
                      {it.ceo_decision_needed && (
                        <span style={{ background: "#5B3F9E", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                          CEO
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
                        {it.project?.name || it.project_raw || ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{it.issue}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                      {[
                        it.department?.name_he || it.department?.name || it.department_raw,
                        it.employee?.full_name || it.person_responsible_raw,
                        it.deadline,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </OpsCard>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OpsCard title={t("operations.report_detail.metadata")}>
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <Field label={t("operations.report_detail.report_date")}>
                {report.report_date}
              </Field>
              <Field label={t("operations.report_detail.source_type")}>
                {report.source_type}
              </Field>
              <Field label={t("operations.report_detail.processed_at")}>
                {formatDate(report.processed_at)}
              </Field>
              <Field label={t("operations.report_detail.confidence")}>
                {confidence}
              </Field>
              {report.employee?.full_name && (
                <Field label={t("operations.col.responsible")}>
                  {report.employee.full_name}
                </Field>
              )}
            </div>
          </OpsCard>

          <OpsCard>
            <button
              onClick={() => setRawExpanded(!rawExpanded)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                padding: 0,
                width: "100%",
              }}
            >
              {rawExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {t("operations.report_detail.raw_text")}
            </button>
            {rawExpanded && (
              <pre
                dir={locale === "he" ? "rtl" : "ltr"}
                style={{
                  marginTop: 12,
                  padding: 14,
                  background: "var(--bg-secondary, #1a1a1a)",
                  border: "1px solid var(--border-light)",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 400,
                  overflowY: "auto",
                  color: "var(--text-primary)",
                }}
              >
                {report.raw_text || "—"}
              </pre>
            )}
          </OpsCard>
        </div>
      </div>
    </OpsPageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
}