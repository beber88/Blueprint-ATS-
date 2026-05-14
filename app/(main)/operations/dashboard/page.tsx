"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from "@/lib/chart-config";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, FileText, Loader2, RefreshCw } from "lucide-react";

interface Stats {
  kpis: { open: number; overdue: number; urgent: number; ceo_pending: number; missing_info: number; alerts: number };
  breakdown: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byDepartment: Record<string, number>;
    byProject: Record<string, number>;
  };
  dailyTrend: Array<{ date: string; total: number; overdue: number; urgent: number }>;
  projects: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; name_he?: string; color?: string }>;
  alerts: Array<{ id: string; type: string; severity: string; message: string; created_at: string }>;
  reports: Array<{ id: string; report_date: string; source_type: string; processing_status: string }>;
  recurringThemes: Array<{ id: string; theme: string; occurrence_count: number }>;
}

const PRIORITY_COLORS: Record<string, string> = { urgent: "#A32D2D", high: "#C9A84C", medium: "#1A56A8", low: "#6B6356" };

export default function OperationsDashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/operations/dashboard/stats");
      const data = await res.json();
      if (res.ok) setStats(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 60000); return () => clearInterval(i); }, [load]);

  if (loading) {
    return (
      <OpsPageShell title={t("operations.dashboard.title")}>
        <div style={{ padding: 60, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
      </OpsPageShell>
    );
  }
  if (!stats) {
    return <OpsPageShell title={t("operations.dashboard.title")}><div>—</div></OpsPageShell>;
  }

  const departmentRows = Object.entries(stats.breakdown.byDepartment).map(([id, count]) => {
    const d = stats.departments.find((x) => x.id === id);
    return { name: d?.name_he || d?.name || id.slice(0, 6), count, color: d?.color || "#C9A84C" };
  }).sort((a, b) => b.count - a.count).slice(0, 8);

  const projectRows = Object.entries(stats.breakdown.byProject).map(([id, count]) => {
    const p = stats.projects.find((x) => x.id === id);
    return { name: p?.name || id.slice(0, 6), count };
  }).sort((a, b) => b.count - a.count).slice(0, 8);

  const priorityRows = Object.entries(stats.breakdown.byPriority).map(([priority, count]) => ({ priority, count }));

  return (
    <OpsPageShell
      title={t("operations.dashboard.title")}
      subtitle={t("operations.dashboard.subtitle")}
      actions={
        <button onClick={load} style={{ padding: "8px 14px", background: "transparent", border: "1px solid var(--border-primary)", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-primary)" }}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t("operations.actions.refresh")}
        </button>
      }
    >
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("operations.kpi.open")} value={stats.kpis.open} accent="#1A56A8" />
        <KpiCard label={t("operations.kpi.overdue")} value={stats.kpis.overdue} accent="#A32D2D" />
        <KpiCard label={t("operations.kpi.urgent")} value={stats.kpis.urgent} accent="#C9A84C" />
        <KpiCard label={t("operations.kpi.ceo_pending")} value={stats.kpis.ceo_pending} accent="#5B3F9E" />
        <KpiCard label={t("operations.kpi.missing_info")} value={stats.kpis.missing_info} accent="#A88B3D" />
        <KpiCard label={t("operations.kpi.alerts")} value={stats.kpis.alerts} accent="#A32D2D" />
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
        {[
          { href: "/hr/operations/intake", labelKey: "operations.nav.intake", icon: FileText },
          { href: "/hr/operations/issues", labelKey: "operations.nav.issues", icon: ArrowUpRight },
          { href: "/hr/operations/ceo-items", labelKey: "operations.nav.ceo_items", icon: ArrowUpRight },
          { href: "/hr/operations/missing-info", labelKey: "operations.nav.missing_info", icon: AlertTriangle },
          { href: "/hr/operations/alerts", labelKey: "operations.nav.alerts", icon: AlertTriangle },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, textDecoration: "none", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}
          >
            <q.icon size={16} style={{ color: "#C9A84C" }} />
            {t(q.labelKey)}
          </Link>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 16 }}>
        <OpsCard title={t("operations.chart.daily_trend")}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.dailyTrend}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date" {...AXIS_STYLE} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#1A56A8" strokeWidth={2} dot={false} name={t("operations.chart.total")} />
              <Line type="monotone" dataKey="overdue" stroke="#A32D2D" strokeWidth={2} dot={false} name={t("operations.chart.overdue")} />
              <Line type="monotone" dataKey="urgent" stroke="#C9A84C" strokeWidth={2} dot={false} name={t("operations.chart.urgent")} />
            </LineChart>
          </ResponsiveContainer>
        </OpsCard>

        <OpsCard title={t("operations.chart.by_priority")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityRows}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="priority" {...AXIS_STYLE} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count">
                {priorityRows.map((row, idx) => (
                  <Cell key={idx} fill={PRIORITY_COLORS[row.priority] || "#C9A84C"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </OpsCard>

        <OpsCard title={t("operations.chart.by_department")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={departmentRows} layout="vertical">
              <CartesianGrid {...GRID_STYLE} />
              <XAxis type="number" {...AXIS_STYLE} />
              <YAxis dataKey="name" type="category" width={120} {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count">
                {departmentRows.map((row, idx) => (
                  <Cell key={idx} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </OpsCard>

        <OpsCard title={t("operations.chart.by_project")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={projectRows} layout="vertical">
              <CartesianGrid {...GRID_STYLE} />
              <XAxis type="number" {...AXIS_STYLE} />
              <YAxis dataKey="name" type="category" width={140} {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#C9A84C" />
            </BarChart>
          </ResponsiveContainer>
        </OpsCard>
      </div>

      {/* Alerts and recurring themes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <OpsCard title={t("operations.dashboard.top_alerts")}>
          {stats.alerts.length === 0 ? (
            <div style={{ color: "var(--text-secondary)" }}>{t("operations.empty.no_alerts")}</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {stats.alerts.slice(0, 8).map((a) => (
                <li key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#A32D2D20", color: "#A32D2D" }}>{a.type}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </OpsCard>

        <OpsCard title={t("operations.dashboard.recurring_themes")}>
          {stats.recurringThemes.length === 0 ? (
            <div style={{ color: "var(--text-secondary)" }}>{t("operations.empty.no_themes")}</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {stats.recurringThemes.slice(0, 8).map((t) => (
                <li key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{t.theme}</span>
                  <span style={{ background: "#C9A84C20", color: "#A88B3D", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{t.occurrence_count}×</span>
                </li>
              ))}
            </ul>
          )}
        </OpsCard>
      </div>
    </OpsPageShell>
  );
}
