"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  contract_id: string;
  type: string;
  severity: string;
  message: string;
  resolved_at: string | null;
  created_at: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  high: "#A32D2D",
  medium: "#C9A84C",
  low: "#888",
};

export default function ContractsAlertsPage() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts/alerts?resolved=false");
      if (res.ok) setAlerts((await res.json()).alerts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string) {
    const res = await fetch("/api/contracts/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resolved: true }),
    });
    if (res.ok) {
      toast.success("resolved");
      load();
    } else {
      toast.error("resolve failed");
    }
  }

  return (
    <OpsPageShell title={t("contracts.alerts.title")}>
      <OpsCard>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Loader2 className="animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", padding: 16, textAlign: "center" }}>
            —
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(163,45,45,0.04)",
                  borderLeft: `3px solid ${SEVERITY_COLOR[a.severity] || "#888"}`,
                }}
              >
                <AlertTriangle size={16} color={SEVERITY_COLOR[a.severity]} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: SEVERITY_COLOR[a.severity],
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {t(`contracts.alerts.type_${a.type}`) || a.type}
                  </div>
                  <div style={{ fontSize: 13 }}>{a.message}</div>
                </div>
                <button
                  onClick={() => resolve(a.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border-light)",
                    background: "transparent",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <CheckCircle2 size={12} /> {t("contracts.alerts.resolve")}
                </button>
              </div>
            ))}
          </div>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
