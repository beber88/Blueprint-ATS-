"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Receipt, Wallet, Plus, FilePlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

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
  }, [tab, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("payroll.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("payroll.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSalaryOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("payroll.actions.adjust_salary")}
          </Button>
          <Button onClick={() => setGenOpen(true)}>
            <FilePlus className="me-2 h-4 w-4" />
            {t("payroll.actions.generate_payslip")}
          </Button>
        </div>
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

      <SalaryDialog
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
        onSaved={() => {
          refresh();
          setTab("salaries");
        }}
      />
      <GeneratePayslipDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        onGenerated={() => {
          refresh();
          setTab("payslips");
        }}
      />
    </div>
  );
}

interface EmployeeOption {
  id: string;
  full_name: string;
}

function useEmployees(open: boolean) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  useEffect(() => {
    if (!open || employees.length > 0) return;
    fetch("/api/employees?limit=200")
      .then((r) => r.json())
      .then((d) =>
        setEmployees(
          (d.employees || []).map((e: { id: string; full_name: string }) => ({
            id: e.id,
            full_name: e.full_name,
          }))
        )
      );
  }, [open, employees.length]);
  return employees;
}

function SalaryDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const employees = useEmployees(open);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    effective_date: new Date().toISOString().slice(0, 10),
    base_salary: "",
    currency: "PHP",
    pay_frequency: "monthly",
    notes: "",
  });

  const submit = async () => {
    if (!form.employee_id || !form.base_salary) {
      toast.error(t("payroll.dialog.required"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/payroll/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, base_salary: Number(form.base_salary) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("payroll.dialog.save_failed"));
        return;
      }
      toast.success(t("payroll.dialog.salary_saved"));
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payroll.dialog.adjust_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("payroll.col.employee")}>
            <select
              value={form.employee_id}
              onChange={(e) => u("employee_id", e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("payroll.col.effective_date")}>
              <Input
                type="date"
                value={form.effective_date}
                onChange={(e) => u("effective_date", e.target.value)}
              />
            </Field>
            <Field label={t("payroll.col.base_salary")}>
              <Input
                type="number"
                value={form.base_salary}
                onChange={(e) => u("base_salary", e.target.value)}
              />
            </Field>
            <Field label={t("payroll.col.currency")}>
              <Input value={form.currency} onChange={(e) => u("currency", e.target.value)} />
            </Field>
            <Field label={t("payroll.col.frequency")}>
              <select
                value={form.pay_frequency}
                onChange={(e) => u("pay_frequency", e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="monthly">monthly</option>
                <option value="semi_monthly">semi_monthly</option>
                <option value="weekly">weekly</option>
                <option value="daily">daily</option>
              </select>
            </Field>
          </div>
          <Field label={t("payroll.dialog.notes")}>
            <Input value={form.notes} onChange={(e) => u("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("payroll.dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneratePayslipDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const employees = useEmployees(open);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [form, setForm] = useState({
    employee_id: "",
    period_start: firstOfMonth.toISOString().slice(0, 10),
    period_end: lastOfMonth.toISOString().slice(0, 10),
  });

  const submit = async () => {
    if (!form.employee_id) {
      toast.error(t("payroll.dialog.required"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/payroll/payslips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || t("payroll.dialog.gen_failed"));
        return;
      }
      toast.success(t("payroll.dialog.payslip_generated"));
      onOpenChange(false);
      onGenerated();
      router.push(`/payroll/payslips/${data.id}`);
    } finally {
      setBusy(false);
    }
  };

  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payroll.dialog.gen_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("payroll.col.employee")}>
            <select
              value={form.employee_id}
              onChange={(e) => u("employee_id", e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("payroll.col.period") + " " + t("payroll.dialog.from")}>
              <Input
                type="date"
                value={form.period_start}
                onChange={(e) => u("period_start", e.target.value)}
              />
            </Field>
            <Field label={t("payroll.col.period") + " " + t("payroll.dialog.to")}>
              <Input
                type="date"
                value={form.period_end}
                onChange={(e) => u("period_end", e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("payroll.dialog.gen_help")}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("payroll.dialog.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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
            <tr
              key={p.id}
              className="cursor-pointer hover:bg-muted/20"
              onClick={() => (window.location.href = `/payroll/payslips/${p.id}`)}
            >
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
