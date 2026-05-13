"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpsCard, OpsPageShell, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";

interface DigestData {
  generated_at: string;
  data: {
    kpis: { open: number; overdue: number; urgent: number; ceo_pending: number; missing_info: number; alerts: number };
    alerts: Array<{ id: string; type: string; severity: string; message: string }>;
    recurringThemes: Array<{ id: string; theme: string; occurrence_count: number }>;
  };
}

export default function DigestPage() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DigestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/operations/digest/${token}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) setData(d);
        else setError(d.error || "Invalid token");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <OpsPageShell title={t("operations.digest.title")}><div style={{ padding: 60, textAlign: "center" }}><Loader2 className="animate-spin" /></div></OpsPageShell>;
  if (error) return <OpsPageShell title={t("operations.digest.title")}><OpsCard><div style={{ color: "#A32D2D" }}>{error}</div></OpsCard></OpsPageShell>;
  if (!data) return null;

  const { kpis, alerts, recurringThemes } = data.data;

  return (
    <OpsPageShell title={t("operations.digest.title")} subtitle={`${t("operations.digest.generated_at")}: ${data.generated_at}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("operations.kpi.open")} value={kpis.open} accent="#1A56A8" />
        <KpiCard label={t("operations.kpi.overdue")} value={kpis.overdue} accent="#A32D2D" />
        <KpiCard label={t("operations.kpi.urgent")} value={kpis.urgent} accent="#C9A84C" />
        <KpiCard label={t("operations.kpi.ceo_pending")} value={kpis.ceo_pending} accent="#5B3F9E" />
        <KpiCard label={t("operations.kpi.missing_info")} value={kpis.missing_info} accent="#A88B3D" />
        <KpiCard label={t("operations.kpi.alerts")} value={kpis.alerts} accent="#A32D2D" />
      </div>

      <OpsCard title={t("operations.dashboard.top_alerts")} style={{ marginBottom: 16 }}>
        {alerts.length === 0 ? <div style={{ color: "var(--text-secondary)" }}>—</div> : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {alerts.slice(0, 20).map((a) => (
              <li key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#A32D2D20", color: "#A32D2D" }}>{a.type}</span>
                {" "}{a.message}
              </li>
            ))}
          </ul>
        )}
      </OpsCard>

      <OpsCard title={t("operations.dashboard.recurring_themes")}>
        {recurringThemes.length === 0 ? <div style={{ color: "var(--text-secondary)" }}>—</div> : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {recurringThemes.slice(0, 20).map((t) => (
              <li key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between" }}>
                <span>{t.theme}</span>
                <span style={{ background: "#C9A84C20", color: "#A88B3D", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{t.occurrence_count}×</span>
              </li>
            ))}
          </ul>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
