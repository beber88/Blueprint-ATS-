"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";

interface ByEmployee { name: string; count: number; latest: string; items: unknown[] }
interface AttRow {
  id: string;
  report_date: string;
  employee_name: string | null;
  status: string;
  priority: string;
  issue: string;
  next_action: string | null;
}

export default function AttendancePage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [byEmployee, setByEmployee] = useState<ByEmployee[]>([]);
  const [items, setItems] = useState<AttRow[]>([]);

  useEffect(() => {
    fetch("/api/operations/attendance?days=30")
      .then((r) => r.json())
      .then((d) => {
        setByEmployee(d.by_employee || []);
        setItems(d.items || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <OpsPageShell title={t("operations.nav.attendance")} subtitle={t("operations.attendance.subtitle")}>
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <OpsCard title={t("operations.attendance.by_employee")} style={{ marginBottom: 16 }}>
            {byEmployee.length === 0 ? (
              <div style={{ color: "var(--text-secondary)" }}>{t("operations.empty.no_attendance")}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.col.employee")}</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.attendance.incidents")}</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.attendance.last_seen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {byEmployee.map((e) => (
                    <tr key={e.name} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "8px 12px" }}>{e.name}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ background: "#A32D2D20", color: "#A32D2D", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{e.count}</span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{e.latest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </OpsCard>

          <OpsCard title={t("operations.attendance.recent_events")}>
            {items.length === 0 ? (
              <div style={{ color: "var(--text-secondary)" }}>{t("operations.empty.no_attendance")}</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {items.slice(0, 50).map((it) => (
                  <li key={it.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{it.report_date} · {it.employee_name || "—"}</div>
                    <div style={{ fontSize: 14 }}>{it.issue}</div>
                    {it.next_action && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>⏵ {it.next_action}</div>}
                  </li>
                ))}
              </ul>
            )}
          </OpsCard>
        </>
      )}
    </OpsPageShell>
  );
}
