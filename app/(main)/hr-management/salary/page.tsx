"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";

interface SalaryRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  currency?: string;
  pay_period?: string;
  effective_date?: string;
}

export default function SalaryPage() {
  const { t } = useI18n();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hr/salary")
      .then((r) => r.json())
      .then((d) => setRecords(d.records || []))
      .finally(() => setLoading(false));
  }, []);

  const totalBase = records.reduce((s, r) => s + r.base_salary, 0);
  const totalNet = records.reduce((s, r) => s + r.net_pay, 0);
  const totalAllowances = records.reduce((s, r) => s + r.allowances, 0);
  const totalDeductions = records.reduce((s, r) => s + r.deductions, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <OpsPageShell
      title={t("hr_mgmt.salary.title")}
      subtitle={t("hr_mgmt.salary.subtitle")}
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("hr_mgmt.salary.base_salary")} value={fmt(totalBase)} accent="#C9A84C" hint="Total monthly" />
        <KpiCard label={t("hr_mgmt.salary.allowances")} value={fmt(totalAllowances)} accent="#10B981" />
        <KpiCard label={t("hr_mgmt.salary.deductions")} value={fmt(totalDeductions)} accent="#EF4444" />
        <KpiCard label={t("hr_mgmt.salary.net_pay")} value={fmt(totalNet)} accent="#3B82F6" hint="Total net" />
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : records.length === 0 ? (
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            {t("hr_mgmt.salary.no_records")}
          </p>
        </OpsCard>
      ) : (
        <OpsCard>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Employee</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.salary.base_salary")}</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.salary.allowances")}</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.salary.deductions")}</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.salary.net_pay")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Period</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr key={rec.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {rec.employee_name || rec.employee_id}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {fmt(rec.base_salary)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#10B981", fontFamily: "monospace" }}>
                    +{fmt(rec.allowances)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#EF4444", fontFamily: "monospace" }}>
                    -{fmt(rec.deductions)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: 600, fontFamily: "monospace" }}>
                    {fmt(rec.net_pay)}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                    {rec.pay_period || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpsCard>
      )}
    </OpsPageShell>
  );
}
