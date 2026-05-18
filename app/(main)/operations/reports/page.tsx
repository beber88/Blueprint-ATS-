"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { FileText, Loader2 } from "lucide-react";

interface Report {
  id: string;
  report_date: string;
  source_type: string;
  processing_status: string;
  created_at: string;
  employee?: { full_name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#2D7A3E",
  processing: "#1A56A8",
  failed: "#A32D2D",
  queued: "#8A7D6B",
};

export default function ReportsListPage() {
  const { t, locale } = useI18n();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/operations/reports?limit=100")
      .then((r) => r.json())
      .then((d) => setReports(d.reports || []))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString(locale === "he" ? "he-IL" : "en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return d; }
  };

  return (
    <OpsPageShell
      title={t("operations.report_list.title")}
      subtitle={t("operations.report_list.subtitle")}
    >
      <OpsCard>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>
            {t("operations.report_list.no_reports")}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-secondary)", textAlign: locale === "he" ? "right" : "left" }}>
                <th style={th}>{t("operations.report_list.col_date")}</th>
                <th style={th}>{t("operations.report_list.col_source")}</th>
                <th style={th}>{t("operations.report_list.col_status")}</th>
                <th style={th}>{t("operations.report_list.col_entered")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{r.report_date}</span>
                  </td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <FileText size={12} />
                      {r.source_type}
                    </span>
                    {r.employee?.full_name && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", marginInlineStart: 6 }}>
                        ({r.employee.full_name})
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: (STATUS_COLORS[r.processing_status] || "#8A7D6B") + "20",
                      color: STATUS_COLORS[r.processing_status] || "#8A7D6B",
                      fontWeight: 600,
                      fontSize: 11,
                    }}>
                      {r.processing_status}
                    </span>
                  </td>
                  <td style={td}>{formatDate(r.created_at)}</td>
                  <td style={td}>
                    <Link
                      href={`/hr/operations/reports/${r.id}`}
                      style={{ color: "#C9A84C", fontWeight: 600, textDecoration: "none" }}
                    >
                      {t("operations.report_list.view")} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}

const th: React.CSSProperties = {
  padding: "8px 6px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: "10px 6px",
  verticalAlign: "top",
};