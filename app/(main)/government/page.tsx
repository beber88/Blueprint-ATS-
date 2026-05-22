"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Calculator,
  CalendarClock,
  Pencil,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Doc {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  file_url: string | null;
  original_language: string | null;
  expiry_date: string | null;
  created_at: string;
  employee: { id: string; full_name: string; national_id: string | null } | null;
}

interface GovIds {
  sss_no: string;
  philhealth_no: string;
  pagibig_no: string;
  tin: string;
}
interface Compliance {
  id: string;
  full_name: string;
  national_id: string | null;
  government_ids: GovIds;
  filled_count: number;
  total_count: number;
  missing: string[];
}

interface RemittanceRow {
  employee_id: string;
  employee_name: string;
  sss_ee: number;
  sss_er: number;
  philhealth_ee: number;
  philhealth_er: number;
  pagibig_ee: number;
  pagibig_er: number;
  withholding_tax: number;
}
interface RemittanceTotals {
  sss_total: number;
  philhealth_total: number;
  pagibig_total: number;
  withholding_tax: number;
  grand_total: number;
}
interface Deadline {
  agency: string;
  form: string;
  label: string;
  applicable_month: string;
  due_date: string;
  days_until: number;
  overdue: boolean;
}

const ID_LABELS: Record<keyof GovIds, string> = {
  sss_no: "SSS",
  philhealth_no: "PhilHealth",
  pagibig_no: "Pag-IBIG",
  tin: "TIN",
};

type Tab = "compliance" | "remittance" | "deadlines";

export default function GovernmentPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("compliance");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [compliance, setCompliance] = useState<Compliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Compliance | null>(null);

  const loadCompliance = useCallback(() => {
    setLoading(true);
    fetch("/api/government-documents")
      .then((r) => r.json())
      .then((data) => {
        setDocs(data.documents || []);
        setCompliance(data.compliance || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  const incomplete = compliance.filter((c) => c.filled_count < c.total_count);
  const complete = compliance.filter((c) => c.filled_count === c.total_count);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("government.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("government.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === "compliance"} onClick={() => setTab("compliance")} icon={ShieldCheck}>
          {t("government.tabs.compliance")}
        </TabBtn>
        <TabBtn active={tab === "remittance"} onClick={() => setTab("remittance")} icon={Calculator}>
          {t("government.tabs.remittance")}
        </TabBtn>
        <TabBtn active={tab === "deadlines"} onClick={() => setTab("deadlines")} icon={CalendarClock}>
          {t("government.tabs.deadlines")}
        </TabBtn>
      </div>

      {tab === "compliance" &&
        (loading ? (
          <Loading />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard icon={ShieldCheck} label={t("government.summary.complete")} value={complete.length} tone="emerald" />
              <SummaryCard icon={AlertTriangle} label={t("government.summary.incomplete")} value={incomplete.length} tone="amber" />
              <SummaryCard icon={FileText} label={t("government.summary.total_documents")} value={docs.length} tone="blue" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold">{t("government.compliance.title")}</h2>
                  <p className="text-xs text-muted-foreground">{t("government.compliance.subtitle")}</p>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {compliance.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {t("government.compliance.all_good")}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {[...incomplete, ...complete].map((c) => (
                        <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <div className="font-medium">{c.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.missing.length > 0
                                ? `${t("government.compliance.missing")}: ${c.missing
                                    .map((m) => ID_LABELS[m as keyof GovIds])
                                    .join(", ")}`
                                : t("government.compliance.all_filled")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`ring-1 ${
                                c.filled_count === c.total_count
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
                                  : "bg-amber-50 text-amber-700 ring-amber-200/60"
                              }`}
                            >
                              {c.filled_count}/{c.total_count}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold">{t("government.documents.title")}</h2>
                  <p className="text-xs text-muted-foreground">{t("government.documents.subtitle")}</p>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {docs.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {t("government.documents.empty")}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {docs.map((d) => (
                        <li key={d.id} className="px-4 py-3 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{d.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {d.employee?.full_name || "—"} · {d.document_type}
                                {d.expiry_date && (
                                  <span className="ms-2 text-amber-600">
                                    {t("government.documents.expires")}: {formatDate(d.expiry_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {d.file_url && (
                              <a
                                href={d.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                {t("government.documents.open")}
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </>
        ))}

      {tab === "remittance" && <RemittancePanel />}
      {tab === "deadlines" && <DeadlinesPanel />}

      {editing && (
        <EditIdsDialog
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadCompliance();
          }}
        />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center p-12 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function EditIdsDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Compliance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [ids, setIds] = useState<GovIds>(employee.government_ids);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ government_ids: ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("government.edit.save_failed"));
        return;
      }
      toast.success(t("government.edit.saved"));
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("government.edit.title")} — {employee.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(Object.keys(ID_LABELS) as (keyof GovIds)[]).map((key) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{ID_LABELS[key]}</span>
              <Input
                value={ids[key]}
                onChange={(e) => setIds((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={ID_LABELS[key]}
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("government.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemittancePanel() {
  const { t } = useI18n();
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RemittanceRow[]>([]);
  const [totals, setTotals] = useState<RemittanceTotals | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ran, setRan] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/government/remittance?period_start=${periodStart}&period_end=${periodEnd}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("government.remittance.failed"));
        return;
      }
      setRows(data.rows || []);
      setTotals(data.totals || null);
      setWarnings(data.warnings || []);
      setRan(true);
    } finally {
      setLoading(false);
    }
  };

  const money = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("government.remittance.from")}
          </span>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("government.remittance.to")}
          </span>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Calculator className="me-2 h-4 w-4" />}
          {t("government.remittance.run")}
        </Button>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {ran && totals && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <AgencyCard label="SSS" value={money(totals.sss_total)} />
            <AgencyCard label="PhilHealth" value={money(totals.philhealth_total)} />
            <AgencyCard label="Pag-IBIG" value={money(totals.pagibig_total)} />
            <AgencyCard label={t("government.remittance.bir")} value={money(totals.withholding_tax)} />
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">{t("government.remittance.employee")}</th>
                  <th className="px-3 py-2 text-end">SSS</th>
                  <th className="px-3 py-2 text-end">PhilHealth</th>
                  <th className="px-3 py-2 text-end">Pag-IBIG</th>
                  <th className="px-3 py-2 text-end">{t("government.remittance.tax")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      {t("government.remittance.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.employee_id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {money(r.sss_ee + r.sss_er)}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {money(r.philhealth_ee + r.philhealth_er)}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {money(r.pagibig_ee + r.pagibig_er)}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">{money(r.withholding_tax)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2">{t("government.remittance.grand_total")}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(totals.sss_total)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(totals.philhealth_total)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(totals.pagibig_total)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(totals.withholding_tax)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("government.remittance.disclaimer")}</p>
        </>
      )}
    </div>
  );
}

function DeadlinesPanel() {
  const { t } = useI18n();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/government/deadlines")
      .then((r) => r.json())
      .then((d) => setDeadlines(d.deadlines || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start">{t("government.deadlines.agency")}</th>
            <th className="px-4 py-3 text-start">{t("government.deadlines.form")}</th>
            <th className="px-4 py-3 text-start">{t("government.deadlines.applicable")}</th>
            <th className="px-4 py-3 text-start">{t("government.deadlines.due")}</th>
            <th className="px-4 py-3 text-start">{t("government.deadlines.status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {deadlines.map((d, i) => (
            <tr key={i} className="hover:bg-muted/20">
              <td className="px-4 py-3 font-medium">{d.agency}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {d.form} · {d.label}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{d.applicable_month}</td>
              <td className="px-4 py-3">{formatDate(d.due_date)}</td>
              <td className="px-4 py-3">
                {d.overdue ? (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 ring-1 ring-rose-200/60">
                    {t("government.deadlines.overdue")}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={`ring-1 ${
                      d.days_until <= 7
                        ? "bg-amber-50 text-amber-700 ring-amber-200/60"
                        : "bg-slate-50 text-slate-700 ring-slate-200/60"
                    }`}
                  >
                    {t("government.deadlines.in_days").replace("{n}", String(d.days_until))}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgencyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TabBtn({
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

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "blue";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}
