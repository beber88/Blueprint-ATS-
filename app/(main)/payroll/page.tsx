"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Receipt, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Employee {
  id: string;
  full_name: string;
}
interface Payslip {
  id: string;
  period_start: string;
  period_end: string;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  status: string;
  employee: Employee | null;
}
interface Salary {
  id: string;
  effective_date: string;
  base_salary: number;
  currency: string;
  pay_frequency: string;
  employee: Employee | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-50 text-slate-700 ring-slate-200/60",
  imported: "bg-amber-50 text-amber-700 ring-amber-200/60",
  approved: "bg-blue-50 text-blue-700 ring-blue-200/60",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
};

export default function PayrollPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"payslips" | "salaries">("payslips");
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = tab === "payslips" ? "/api/payroll/payslips" : "/api/payroll/salary";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (tab === "payslips") setPayslips(data.payslips || []);
        else setSalaries(data.salaries || []);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("payroll.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("payroll.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b">
        <TabButton active={tab === "payslips"} onClick={() => setTab("payslips")} icon={Receipt}>
          {t("payroll.tabs.payslips")}
        </TabButton>
        <TabButton active={tab === "salaries"} onClick={() => setTab("salaries")} icon={Wallet}>
          {t("payroll.tabs.salaries")}
        </TabButton>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "payslips" ? (
        <PayslipsTable payslips={payslips} />
      ) : (
        <SalariesTable salaries={salaries} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`relative rounded-none px-4 ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      <Icon className="me-2 h-4 w-4" />
      {children}
      {active && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />}
    </Button>
  );
}

function PayslipsTable({ payslips }: { payslips: Payslip[] }) {
  const { t } = useI18n();
  if (payslips.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("payroll.empty.payslips")}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start">{t("payroll.col.employee")}</th>
            <th className="px-4 py-3 text-start">{t("payroll.col.period")}</th>
            <th className="px-4 py-3 text-end">{t("payroll.col.gross")}</th>
            <th className="px-4 py-3 text-end">{t("payroll.col.deductions")}</th>
            <th className="px-4 py-3 text-end">{t("payroll.col.net")}</th>
            <th className="px-4 py-3 text-start">{t("payroll.col.status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payslips.map((p) => (
            <tr key={p.id} className="hover:bg-muted/20">
              <td className="px-4 py-3 font-medium">{p.employee?.full_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(p.period_start)} — {formatDate(p.period_end)}
              </td>
              <td className="px-4 py-3 text-end">{p.gross_pay?.toLocaleString() ?? "—"}</td>
              <td className="px-4 py-3 text-end text-muted-foreground">{p.total_deductions?.toLocaleString() ?? "—"}</td>
              <td className="px-4 py-3 text-end font-semibold">{p.net_pay?.toLocaleString() ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[p.status] || ""}`}>{p.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalariesTable({ salaries }: { salaries: Salary[] }) {
  const { t } = useI18n();
  if (salaries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("payroll.empty.salaries")}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start">{t("payroll.col.employee")}</th>
            <th className="px-4 py-3 text-start">{t("payroll.col.effective_date")}</th>
            <th className="px-4 py-3 text-end">{t("payroll.col.base_salary")}</th>
            <th className="px-4 py-3 text-start">{t("payroll.col.currency")}</th>
            <th className="px-4 py-3 text-start">{t("payroll.col.frequency")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {salaries.map((s) => (
            <tr key={s.id} className="hover:bg-muted/20">
              <td className="px-4 py-3 font-medium">{s.employee?.full_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(s.effective_date)}</td>
              <td className="px-4 py-3 text-end font-semibold">{s.base_salary.toLocaleString()}</td>
              <td className="px-4 py-3">{s.currency}</td>
              <td className="px-4 py-3">{s.pay_frequency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
