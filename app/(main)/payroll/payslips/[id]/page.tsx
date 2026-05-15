"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface LineItem {
  label: string;
  amount: number;
}
interface Breakdown {
  base_salary: number;
  allowances: LineItem[];
  allowances_total: number;
  gross_pay: number;
  statutory: {
    sss: number;
    philhealth: number;
    pagibig: number;
    withholding_tax: number;
    total: number;
  };
  other_deductions: LineItem[];
  other_deductions_total: number;
  total_deductions: number;
  net_pay: number;
  currency: string;
  computed_at: string;
}
interface Payslip {
  id: string;
  period_start: string;
  period_end: string;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  breakdown: Breakdown | null;
  status: string;
  created_at: string;
  employee: { id: string; full_name: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-50 text-slate-700 ring-slate-200/60",
  imported: "bg-amber-50 text-amber-700 ring-amber-200/60",
  approved: "bg-blue-50 text-blue-700 ring-blue-200/60",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
};

const NEXT_ACTIONS: Record<string, { status: string; labelKey: string }[]> = {
  draft: [{ status: "approved", labelKey: "payroll.detail.approve" }],
  imported: [{ status: "approved", labelKey: "payroll.detail.approve" }],
  approved: [{ status: "paid", labelKey: "payroll.detail.mark_paid" }],
  paid: [],
};

export default function PayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/payslips/${id}`);
      if (res.ok) setPayslip(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const transition = async (status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/payroll/payslips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || t("payroll.detail.transition_failed"));
        return;
      }
      toast.success(t("payroll.detail.status_updated"));
      await load();
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!payslip) {
    return <div className="p-12 text-center text-muted-foreground">{t("payroll.detail.not_found")}</div>;
  }

  const b = payslip.breakdown;
  const cur = b?.currency || "PHP";
  const money = (n: number | null | undefined) =>
    n == null ? "—" : `${cur} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="print:hidden">
        <Link
          href="/payroll"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("payroll.title")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{payslip.employee?.full_name || "—"}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {formatDate(payslip.period_start)} — {formatDate(payslip.period_end)}
              </span>
              <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[payslip.status] || ""}`}>
                {payslip.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="me-2 h-4 w-4" />
              {t("payroll.detail.print")}
            </Button>
            {(NEXT_ACTIONS[payslip.status] || []).map((a) => (
              <Button key={a.status} size="sm" disabled={updating} onClick={() => transition(a.status)}>
                {updating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t(a.labelKey)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="text-lg font-semibold">{t("payroll.detail.payslip")}</div>
            <div className="text-xs text-muted-foreground">
              {formatDate(payslip.period_start)} — {formatDate(payslip.period_end)}
            </div>
          </div>
          <div className="text-end">
            <div className="font-medium">{payslip.employee?.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {t("payroll.detail.generated")}: {formatDate(payslip.created_at)}
            </div>
          </div>
        </div>

        {b ? (
          <>
            <Group title={t("payroll.detail.earnings")}>
              <Row label={t("payroll.detail.base_salary")} value={money(b.base_salary)} />
              {b.allowances.map((a) => (
                <Row key={a.label} label={a.label} value={money(a.amount)} indent />
              ))}
              {b.allowances.length > 0 && (
                <Row
                  label={t("payroll.detail.allowances_total")}
                  value={money(b.allowances_total)}
                  muted
                />
              )}
              <Row label={t("payroll.detail.gross_pay")} value={money(b.gross_pay)} bold />
            </Group>

            <Group title={t("payroll.detail.statutory")}>
              <Row label="SSS" value={money(b.statutory.sss)} />
              <Row label="PhilHealth" value={money(b.statutory.philhealth)} />
              <Row label="Pag-IBIG" value={money(b.statutory.pagibig)} />
              <Row label={t("payroll.detail.withholding_tax")} value={money(b.statutory.withholding_tax)} />
              <Row label={t("payroll.detail.statutory_total")} value={money(b.statutory.total)} muted />
            </Group>

            {b.other_deductions.length > 0 && (
              <Group title={t("payroll.detail.other_deductions")}>
                {b.other_deductions.map((d) => (
                  <Row key={d.label} label={d.label} value={money(d.amount)} />
                ))}
                <Row
                  label={t("payroll.detail.other_deductions_total")}
                  value={money(b.other_deductions_total)}
                  muted
                />
              </Group>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">{t("payroll.detail.total_deductions")}</span>
              <span className="font-medium">{money(b.total_deductions)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-emerald-50 px-4 py-3">
              <span className="font-semibold text-emerald-900">{t("payroll.detail.net_pay")}</span>
              <span className="text-xl font-bold text-emerald-900">{money(b.net_pay)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("payroll.detail.disclaimer")}</p>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <Row label={t("payroll.col.gross")} value={money(payslip.gross_pay)} />
            <Row label={t("payroll.col.deductions")} value={money(payslip.total_deductions)} />
            <Row label={t("payroll.col.net")} value={money(payslip.net_pay)} bold />
            <p className="text-xs text-muted-foreground">{t("payroll.detail.no_breakdown")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  indent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${
        bold ? "font-semibold" : ""
      } ${muted ? "text-muted-foreground" : ""} ${indent ? "ps-4" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
