"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";

interface Kpis {
  active: number;
  expiring30d: number;
  expired: number;
  flagged: number;
  openAlerts: number;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: string;
}

export default function ContractsDashboard() {
  const { t } = useI18n();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        fetch("/api/contracts/dashboard/stats"),
        fetch("/api/contracts/alerts?resolved=false&limit=10"),
      ]);
      if (statsRes.ok) setKpis((await statsRes.json()).kpis);
      if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <OpsPageShell title={t("contracts.dashboard.title")}>
        <div style={{ padding: 60, textAlign: "center" }}>
          <Loader2 className="animate-spin" />
        </div>
      </OpsPageShell>
    );
  }

  return (
    <OpsPageShell
      title={t("contracts.dashboard.title")}
      subtitle={t("contracts.dashboard.subtitle")}
      actions={
        <Link
          href="/hr/contracts/intake"
          style={{
            background: "#C9A84C",
            color: "#1A1A1A",
            padding: "8px 14px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          + {t("contracts.intake.title")}
        </Link>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard label={t("contracts.dashboard.kpi_active")} value={kpis?.active ?? 0} />
        <KpiCard
          label={t("contracts.dashboard.kpi_expiring")}
          value={kpis?.expiring30d ?? 0}
          accent={kpis && kpis.expiring30d > 0 ? "#C9A84C" : undefined}
        />
        <KpiCard
          label={t("contracts.dashboard.kpi_expired")}
          value={kpis?.expired ?? 0}
          accent={kpis && kpis.expired > 0 ? "#A32D2D" : undefined}
        />
        <KpiCard
          label={t("contracts.dashboard.kpi_flagged")}
          value={kpis?.flagged ?? 0}
          accent={kpis && kpis.flagged > 0 ? "#C9A84C" : undefined}
        />
      </div>

      <OpsCard title={t("contracts.alerts.title")}>
        {alerts.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>—</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(163,45,45,0.06)",
                }}
              >
                <AlertTriangle
                  size={16}
                  color={
                    a.severity === "high"
                      ? "#A32D2D"
                      : a.severity === "medium"
                      ? "#C9A84C"
                      : "#888"
                  }
                />
                <div style={{ flex: 1, fontSize: 13 }}>{a.message}</div>
                <FileText size={14} color="#888" />
              </div>
            ))}
            <Link
              href="/hr/contracts/alerts"
              style={{
                fontSize: 12,
                color: "#C9A84C",
                textDecoration: "none",
                marginTop: 4,
              }}
            >
              {t("contracts.alerts.title")} →
            </Link>
          </div>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
