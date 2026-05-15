"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";

interface Warning {
  code: string;
  severity: "low" | "medium" | "high";
}

interface DraftRow {
  id: string;
  status: string;
  source_kind: string;
  created_at: string;
  ai_output_json: {
    report_date?: string;
    project_name?: string;
    items?: Array<{ project?: string }>;
  };
  warnings_json: Warning[];
}

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  high:   { bg: "#FBEAEA", fg: "#7A1F1F" },
  medium: { bg: "#FFF7E6", fg: "#7A5A1F" },
  low:    { bg: "#F0F0F0", fg: "#3A3A3A" },
};

export default function DraftsInboxPage() {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("draft,flagged");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState("any");

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("status", statusFilter);
    if (sourceFilter) qs.set("source_kind", sourceFilter);
    if (severityFilter !== "any") qs.set("severity", severityFilter);
    fetch(`/api/operations/drafts?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => setDrafts(d.drafts || []))
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter, severityFilter]);

  function countsBySeverity(ws: Warning[]) {
    return ws.reduce<Record<string, number>>((acc, w) => {
      acc[w.severity] = (acc[w.severity] || 0) + 1;
      return acc;
    }, {});
  }

  function pickProject(d: DraftRow): string {
    const ai = d.ai_output_json || {};
    return (
      ai.project_name ||
      (ai.items && ai.items[0]?.project) ||
      "—"
    );
  }

  return (
    <OpsPageShell
      title={t("operations.drafts.title")}
      subtitle={t("operations.drafts.subtitle")}
    >
      <OpsCard>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <label style={filterLabel}>
            {t("operations.drafts.filter_status")}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterSelect}>
              <option value="draft,flagged">{t("operations.drafts.status_open")}</option>
              <option value="draft">{t("operations.draft_status.draft")}</option>
              <option value="flagged">{t("operations.draft_status.flagged")}</option>
              <option value="saved">{t("operations.draft_status.saved")}</option>
              <option value="discarded">{t("operations.draft_status.discarded")}</option>
            </select>
          </label>
          <label style={filterLabel}>
            {t("operations.drafts.filter_source")}
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={filterSelect}>
              <option value="">{t("operations.drafts.source_any")}</option>
              <option value="manual">{t("operations.draft_source.manual")}</option>
              <option value="bulk">{t("operations.draft_source.bulk")}</option>
              <option value="retry">{t("operations.draft_source.retry")}</option>
            </select>
          </label>
          <label style={filterLabel}>
            {t("operations.drafts.filter_severity")}
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={filterSelect}>
              <option value="any">{t("operations.drafts.source_any")}</option>
              <option value="high">{t("operations.priority.high")}</option>
              <option value="medium">{t("operations.priority.medium")}</option>
              <option value="low">{t("operations.priority.low")}</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p>...</p>
        ) : drafts.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>
            {t("operations.drafts.empty")}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-light)" }}>
                <th style={th}>{t("operations.drafts.col_created")}</th>
                <th style={th}>{t("operations.drafts.col_source")}</th>
                <th style={th}>{t("operations.drafts.col_date")}</th>
                <th style={th}>{t("operations.drafts.col_project")}</th>
                <th style={th}>{t("operations.drafts.col_warnings")}</th>
                <th style={th}>{t("operations.drafts.col_status")}</th>
                <th style={th}>{t("operations.drafts.col_action")}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const counts = countsBySeverity(d.warnings_json || []);
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={td}>{new Date(d.created_at).toLocaleString()}</td>
                    <td style={td}>{t("operations.draft_source." + d.source_kind) || d.source_kind}</td>
                    <td style={td}>{d.ai_output_json?.report_date || "—"}</td>
                    <td style={td}>{pickProject(d)}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        {(["high", "medium", "low"] as const).map((sev) =>
                          counts[sev] ? (
                            <span
                              key={sev}
                              style={{
                                ...severityChip,
                                background: SEVERITY_COLORS[sev].bg,
                                color: SEVERITY_COLORS[sev].fg,
                              }}
                            >
                              {sev}:{counts[sev]}
                            </span>
                          ) : null
                        )}
                        {Object.keys(counts).length === 0 && (
                          <span style={{ color: "var(--text-secondary)" }}>—</span>
                        )}
                      </span>
                    </td>
                    <td style={td}>{t("operations.draft_status." + d.status) || d.status}</td>
                    <td style={td}>
                      <Link
                        href={`/hr/operations/intake/preview/${d.id}`}
                        style={{ color: "#C9A84C", fontWeight: 600 }}
                      >
                        {t("operations.drafts.open")} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}

const filterLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "var(--text-secondary)",
};

const filterSelect: React.CSSProperties = {
  padding: 6,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  borderRadius: 6,
  minWidth: 140,
};

const th: React.CSSProperties = {
  padding: "8px 6px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: "8px 6px",
  verticalAlign: "top",
};

const severityChip: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
};
