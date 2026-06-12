"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Award,
  AlertTriangle,
  Plus,
  Check,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { LocalizedText } from "@/components/shared/LocalizedText";

interface Employee {
  id: string;
  full_name: string;
}
interface ConductRecord {
  id: string;
  employee_id: string;
  event_type: "disciplinary_action" | "recognition";
  event_date: string;
  title: string;
  description: string | null;
  metadata: {
    kind?: string;
    severity?: string;
    category?: string | null;
    acknowledged?: boolean;
    award?: string | null;
    points?: number;
  } | null;
  employee: Employee | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  verbal: "bg-amber-50 text-amber-700 ring-amber-200/60",
  written: "bg-orange-50 text-orange-700 ring-orange-200/60",
  final_warning: "bg-rose-50 text-rose-700 ring-rose-200/60",
  suspension: "bg-rose-100 text-rose-800 ring-rose-300/60",
};
const SEVERITIES = ["verbal", "written", "final_warning", "suspension"];

function useEmployees(active: boolean) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    if (!active || employees.length > 0) return;
    fetch("/api/employees?limit=200")
      .then((r) => r.json())
      .then((d) =>
        setEmployees((d.employees || []).map((e: Employee) => ({ id: e.id, full_name: e.full_name })))
      );
  }, [active, employees.length]);
  return employees;
}

export default function ConductPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"disciplinary_action" | "recognition">("disciplinary_action");
  const [records, setRecords] = useState<ConductRecord[]>([]);
  const [summary, setSummary] = useState({ discipline: 0, recognition: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/conduct?type=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        setRecords(d.records || []);
        if (d.summary) setSummary(d.summary);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const isDiscipline = tab === "disciplinary_action";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("conduct.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("conduct.subtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {isDiscipline ? t("conduct.actions.log_discipline") : t("conduct.actions.log_recognition")}
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        <TabBtn active={isDiscipline} onClick={() => setTab("disciplinary_action")} icon={AlertTriangle}>
          {t("conduct.tabs.discipline")}
          {summary.discipline > 0 && (
            <span className="ms-2 rounded-full bg-muted px-1.5 text-xs">{summary.discipline}</span>
          )}
        </TabBtn>
        <TabBtn active={!isDiscipline} onClick={() => setTab("recognition")} icon={Award}>
          {t("conduct.tabs.recognition")}
          {summary.recognition > 0 && (
            <span className="ms-2 rounded-full bg-muted px-1.5 text-xs">{summary.recognition}</span>
          )}
        </TabBtn>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {isDiscipline ? t("conduct.empty.discipline") : t("conduct.empty.recognition")}
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <ConductCard key={r.id} record={r} onChanged={load} />
          ))}
        </ul>
      )}

      {dialogOpen && (
        <ConductDialog
          type={tab}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ConductCard({ record, onChanged }: { record: ConductRecord; onChanged: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const isDiscipline = record.event_type === "disciplinary_action";
  const m = record.metadata || {};

  const acknowledge = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/conduct/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      });
      if (res.ok) {
        toast.success(t("conduct.card.acknowledged"));
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!window.confirm(t("conduct.card.confirm_delete"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/conduct/${record.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("conduct.card.deleted"));
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isDiscipline ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {isDiscipline ? <AlertTriangle className="h-5 w-5" /> : <Award className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{record.title}</span>
              {isDiscipline && m.severity && (
                <Badge variant="outline" className={`ring-1 ${SEVERITY_COLOR[m.severity] || ""}`}>
                  {m.severity.replace("_", " ")}
                </Badge>
              )}
              {!isDiscipline && typeof m.points === "number" && m.points > 0 && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                  +{m.points} {t("conduct.card.points")}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {record.employee?.full_name || "—"} · {formatDate(record.event_date)}
              {isDiscipline && m.category && <span> · {m.category}</span>}
              {!isDiscipline && m.award && <span> · {m.award}</span>}
            </div>
            {record.description && (
              <LocalizedText
                table="hr_employee_timeline"
                record={record}
                field="description"
                as="p"
                className="mt-1 whitespace-pre-wrap text-sm"
              />
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isDiscipline &&
            (m.acknowledged ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                <Check className="me-1 h-3 w-3" />
                {t("conduct.card.acknowledged_badge")}
              </Badge>
            ) : (
              <Button variant="outline" size="sm" disabled={busy} onClick={acknowledge}>
                {t("conduct.card.acknowledge")}
              </Button>
            ))}
          <Button variant="ghost" size="sm" disabled={busy} onClick={del}>
            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function ConductDialog({
  type,
  onClose,
  onSaved,
}: {
  type: "disciplinary_action" | "recognition";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const employees = useEmployees(true);
  const [busy, setBusy] = useState(false);
  const isDiscipline = type === "disciplinary_action";

  const [form, setForm] = useState({
    employee_id: "",
    title: "",
    description: "",
    event_date: new Date().toISOString().slice(0, 10),
    severity: "verbal",
    category: "",
    award: "",
    points: "0",
  });
  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.employee_id || !form.title.trim()) {
      toast.error(t("conduct.dialog.required"));
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        type,
        employee_id: form.employee_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
      };
      if (isDiscipline) {
        payload.severity = form.severity;
        payload.category = form.category.trim() || null;
      } else {
        payload.award = form.award.trim() || null;
        payload.points = Number(form.points) || 0;
      }
      const res = await fetch("/api/conduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("conduct.dialog.save_failed"));
        return;
      }
      toast.success(t("conduct.dialog.saved"));
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDiscipline ? t("conduct.dialog.discipline_title") : t("conduct.dialog.recognition_title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("conduct.dialog.employee")}>
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
          <Field label={t("conduct.dialog.title_field")}>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("conduct.dialog.date")}>
              <Input type="date" value={form.event_date} onChange={(e) => u("event_date", e.target.value)} />
            </Field>
            {isDiscipline ? (
              <Field label={t("conduct.dialog.severity")}>
                <select
                  value={form.severity}
                  onChange={(e) => u("severity", e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label={t("conduct.dialog.points")}>
                <Input type="number" value={form.points} onChange={(e) => u("points", e.target.value)} />
              </Field>
            )}
          </div>
          {isDiscipline ? (
            <Field label={t("conduct.dialog.category")}>
              <Input
                value={form.category}
                onChange={(e) => u("category", e.target.value)}
                placeholder={t("conduct.dialog.category_ph")}
              />
            </Field>
          ) : (
            <Field label={t("conduct.dialog.award")}>
              <Input
                value={form.award}
                onChange={(e) => u("award", e.target.value)}
                placeholder={t("conduct.dialog.award_ph")}
              />
            </Field>
          )}
          <Field label={t("conduct.dialog.description")}>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => u("description", e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("conduct.dialog.save")}
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
