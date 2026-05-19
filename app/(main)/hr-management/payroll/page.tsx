"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, CheckCircle, DollarSign, Users, FileText } from "lucide-react";
import { toast } from "sonner";

interface PayslipResult {
  employee_id: string;
  employee_name: string;
  role: string;
  has_salary: boolean;
  base_salary?: number;
  breakdown?: {
    basic_pay: number;
    gross_pay: number;
    sss_employee: number;
    philhealth_employee: number;
    pagibig_employee: number;
    withholding_tax: number;
    total_statutory: number;
    total_deductions: number;
    net_pay: number;
  };
}

interface PayrollRun {
  period_start: string;
  period_end: string;
  payslips: PayslipResult[];
  total_employees: number;
  with_salary: number;
  total_gross: number;
  total_net: number;
}

function fmt(n: number) {
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayrollPage() {
  const { locale } = useI18n();
  const isHe = locale === "he";

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const isFirstHalf = now.getDate() <= 15;

  const [periodStart, setPeriodStart] = useState(isFirstHalf ? `${y}-${m}-01` : `${y}-${m}-16`);
  const [periodEnd, setPeriodEnd] = useState(isFirstHalf ? `${y}-${m}-15` : `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`);
  const [running, setRunning] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState<PayrollRun | null>(null);

  const runPayroll = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/hr/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      toast.success(isHe ? `חושב שכר ל-${data.with_salary} עובדים` : `Computed payroll for ${data.with_salary} employees`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setRunning(false);
    }
  };

  const finalizePayroll = async () => {
    if (!window.confirm(isHe ? "לאשר ולשמור את השכר? לא ניתן לבטל." : "Finalize and save payroll? This cannot be undone.")) return;
    setFinalizing(true);
    try {
      const res = await fetch("/api/hr/payroll/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(isHe ? `${data.created} תלושים נשמרו בהצלחה` : `${data.created} payslips saved successfully`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="p-6 space-y-6" dir={isHe ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">{isHe ? "הרצת שכר" : "Payroll Run"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isHe ? "חישוב שכר אוטומטי עם ניכויים פיליפיניים (SSS, PhilHealth, Pag-IBIG, מס)" : "Automatic payroll with PH statutory deductions (SSS, PhilHealth, Pag-IBIG, Tax)"}
        </p>
      </div>

      {/* Period Selection */}
      <div className="rounded-lg border p-4 flex items-end gap-4 flex-wrap">
        <div>
          <Label>{isHe ? "תחילת תקופה" : "Period Start"}</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-[180px]" />
        </div>
        <div>
          <Label>{isHe ? "סוף תקופה" : "Period End"}</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-[180px]" />
        </div>
        <Button onClick={runPayroll} disabled={running} className="h-10">
          {running ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Play className="h-4 w-4 me-2" />}
          {isHe ? "חשב שכר" : "Run Payroll"}
        </Button>
        {result && (
          <Button onClick={finalizePayroll} disabled={finalizing} variant="default" className="h-10 bg-green-600 hover:bg-green-700">
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle className="h-4 w-4 me-2" />}
            {isHe ? "אשר ושמור" : "Finalize & Save"}
          </Button>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                {isHe ? "עובדים" : "Employees"}
              </div>
              <p className="text-2xl font-bold">{result.with_salary} / {result.total_employees}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                {isHe ? 'סה"כ ברוטו' : "Total Gross"}
              </div>
              <p className="text-2xl font-bold">{fmt(result.total_gross)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <FileText className="h-4 w-4" />
                {isHe ? 'סה"כ נטו' : "Total Net"}
              </div>
              <p className="text-2xl font-bold text-green-600">{fmt(result.total_net)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                {isHe ? 'סה"כ ניכויים' : "Total Deductions"}
              </div>
              <p className="text-2xl font-bold text-red-500">{fmt(result.total_gross - result.total_net)}</p>
            </div>
          </div>

          {/* Payslips Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start py-2 px-3">{isHe ? "עובד" : "Employee"}</th>
                  <th className="text-start py-2 px-3">{isHe ? "תפקיד" : "Role"}</th>
                  <th className="text-end py-2 px-3">{isHe ? "בסיס" : "Basic"}</th>
                  <th className="text-end py-2 px-3">{isHe ? "ברוטו" : "Gross"}</th>
                  <th className="text-end py-2 px-3">SSS</th>
                  <th className="text-end py-2 px-3">PhilHealth</th>
                  <th className="text-end py-2 px-3">Pag-IBIG</th>
                  <th className="text-end py-2 px-3">{isHe ? "מס" : "Tax"}</th>
                  <th className="text-end py-2 px-3 font-bold">{isHe ? "נטו" : "Net"}</th>
                </tr>
              </thead>
              <tbody>
                {result.payslips.filter((p) => p.has_salary).map((p) => (
                  <tr key={p.employee_id} className="border-t hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{p.employee_name}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{p.role || "—"}</td>
                    <td className="py-2 px-3 text-end">{fmt(p.breakdown!.basic_pay)}</td>
                    <td className="py-2 px-3 text-end">{fmt(p.breakdown!.gross_pay)}</td>
                    <td className="py-2 px-3 text-end text-red-500">{fmt(p.breakdown!.sss_employee)}</td>
                    <td className="py-2 px-3 text-end text-red-500">{fmt(p.breakdown!.philhealth_employee)}</td>
                    <td className="py-2 px-3 text-end text-red-500">{fmt(p.breakdown!.pagibig_employee)}</td>
                    <td className="py-2 px-3 text-end text-red-500">{fmt(p.breakdown!.withholding_tax)}</td>
                    <td className="py-2 px-3 text-end font-bold text-green-600">{fmt(p.breakdown!.net_pay)}</td>
                  </tr>
                ))}
                {result.payslips.filter((p) => !p.has_salary).length > 0 && (
                  <tr className="border-t bg-yellow-50 dark:bg-yellow-950/20">
                    <td colSpan={9} className="py-2 px-3 text-yellow-700 dark:text-yellow-400 text-xs">
                      {isHe ? "עובדים ללא רשומת שכר:" : "Employees without salary record:"}{" "}
                      {result.payslips.filter((p) => !p.has_salary).map((p) => p.employee_name).join(", ")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}