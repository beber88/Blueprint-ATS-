"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
  item?: { id: string; issue: string } | null;
  project?: { id: string; name: string } | null;
}

const SEVERITY_COLORS: Record<string, string> = { urgent: "#A32D2D", high: "#C9A84C", medium: "#1A56A8", low: "#6B6356" };

export default function AlertsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/operations/alerts${includeResolved ? "?include_resolved=true" : ""}`);
    const data = await res.json();
    setAlerts(data.alerts || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [includeResolved]);

  const dismiss = async (id: string) => {
    await fetch(`/api/operations/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: true }),
    });
    toast.success(t("operations.toast.alert_dismissed"));
    load();
  };

  return (
    <OpsPageShell
      title={t("operations.nav.alerts")}
      subtitle={t("operations.alerts.subtitle")}
      actions={
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
          {t("operations.alerts.include_resolved")}
        </label>
      }
    >
      <OpsCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("operations.empty.no_alerts")}</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {alerts.map((a) => (
              <li key={a.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-light)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: SEVERITY_COLORS[a.severity] + "20", color: SEVERITY_COLORS[a.severity], textTransform: "uppercase" }}>{a.type}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                    {a.created_at?.slice(0, 16)} {a.project?.name ? `· ${a.project.name}` : ""}
                  </div>
                </div>
                {!a.resolved_at && (
                  <button
                    onClick={() => dismiss(a.id)}
                    style={{ background: "transparent", border: "1px solid var(--border-primary)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
                  >
                    <Check size={12} /> {t("operations.alerts.dismiss")}
                  </button>
                )}
                {a.resolved_at && <span style={{ color: "#2D7A3E", fontSize: 12 }}>✓</span>}
              </li>
            ))}
          </ul>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
