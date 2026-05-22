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
import { Loader2, Clock, CalendarDays, Plus, Check, X, Trash2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface Employee {
  id: string;
  full_name: string;
}
interface AttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status: string;
  notes: string | null;
  source: string;
  employee: Employee | null;
}
interface LeaveRow {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  employee: Employee | null;
}

const STATUS_COLOR: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  absent: "bg-rose-50 text-rose-700 ring-rose-200/60",
  late: "bg-amber-50 text-amber-700 ring-amber-200/60",
  half_day: "bg-amber-50 text-amber-700 ring-amber-200/60",
  on_leave: "bg-blue-50 text-blue-700 ring-blue-200/60",
  pending: "bg-amber-50 text-amber-700 ring-amber-200/60",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200/60",
  cancelled: "bg-slate-50 text-slate-700 ring-slate-200/60",
};

const ATT_STATUSES = ["present", "absent", "late", "half_day", "on_leave"];
const LEAVE_TYPES = ["vacation", "sick", "emergency", "unpaid", "maternity", "paternity", "bereavement"];

function useEmployees(active: boolean) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    if (!active || employees.length > 0) return;
    fetch("/api/employees?limit=200")
      .then((r) => r.json())
      .then((d) =>
        setEmployees(
          (d.employees || []).map((e: Employee) => ({ id: e.id, full_name: e.full_name }))
        )
      );
  }, [active, employees.length]);
  return employees;
}

export default function AttendancePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"attendance" | "leave">("attendance");
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [attDialog, setAttDialog] = useState<AttendanceRow | "new" | null>(null);
  const [leaveDialog, setLeaveDialog] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const url = tab === "attendance" ? "/api/attendance" : "/api/leave-requests";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (tab === "attendance") setAttendance(data.records || []);
        else setLeaves(data.requests || []);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("attendance.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("attendance.subtitle")}</p>
        </div>
        {tab === "attendance" ? (
          <Button onClick={() => setAttDialog("new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("attendance.actions.add")}
          </Button>
        ) : (
          <Button onClick={() => setLeaveDialog(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("attendance.actions.new_leave")}
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === "attendance"} onClick={() => setTab("attendance")} icon={Clock}>
          {t("attendance.tabs.attendance")}
        </TabBtn>
        <TabBtn active={tab === "leave"} onClick={() => setTab("leave")} icon={CalendarDays}>
          {t("attendance.tabs.leave")}
        </TabBtn>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "attendance" ? (
        attendance.length === 0 ? (
          <Empty msg={t("attendance.empty.attendance")} />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t("attendance.col.employee")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.date")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.clock_in")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.clock_out")}</th>
                  <th className="px-4 py-3 text-end">{t("attendance.col.hours")}</th>
                  <th className="px-4 py-3 text-end">{t("attendance.col.overtime")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendance.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => setAttDialog(r)}
                  >
                    <td className="px-4 py-3 font-medium">{r.employee?.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.clock_in ? formatDateTime(r.clock_in) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.clock_out ? formatDateTime(r.clock_out) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">{r.total_hours?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3 text-end text-muted-foreground">
                      {r.overtime_hours?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[r.status] || ""}`}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : leaves.length === 0 ? (
        <Empty msg={t("attendance.empty.leave")} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("attendance.col.employee")}</th>
                <th className="px-4 py-3 text-start">{t("attendance.col.leave_type")}</th>
                <th className="px-4 py-3 text-start">{t("attendance.col.range")}</th>
                <th className="px-4 py-3 text-end">{t("attendance.col.days")}</th>
                <th className="px-4 py-3 text-start">{t("attendance.col.status")}</th>
                <th className="px-4 py-3 text-end">{t("attendance.col.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leaves.map((l) => (
                <LeaveTableRow key={l.id} leave={l} onChanged={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {attDialog && (
        <AttendanceDialog
          record={attDialog === "new" ? null : attDialog}
          onClose={() => setAttDialog(null)}
          onSaved={() => {
            setAttDialog(null);
            load();
          }}
        />
      )}
      {leaveDialog && (
        <LeaveDialog
          onClose={() => setLeaveDialog(false)}
          onSaved={() => {
            setLeaveDialog(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function LeaveTableRow({ leave, onChanged }: { leave: LeaveRow; onChanged: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const patch = async (status: string, rejection_reason?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/leave-requests/${leave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejection_reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || t("attendance.leave.action_failed"));
        return;
      }
      toast.success(t("attendance.leave.updated"));
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const reject = () => {
    const reason = window.prompt(t("attendance.leave.reject_prompt"));
    if (reason && reason.trim()) patch("rejected", reason.trim());
  };

  return (
    <tr className="hover:bg-muted/20">
      <td className="px-4 py-3 font-medium">{leave.employee?.full_name || "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{leave.leave_type}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
        {leave.rejection_reason && (
          <div className="text-xs text-rose-600">{leave.rejection_reason}</div>
        )}
      </td>
      <td className="px-4 py-3 text-end">{leave.days_count}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[leave.status] || ""}`}>
          {leave.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {leave.status === "pending" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => patch("approved")}
                className="h-7 text-emerald-700"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={reject}
                className="h-7 text-rose-700"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {leave.status === "approved" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => patch("cancelled")}
              className="h-7 text-xs text-muted-foreground"
            >
              {t("attendance.leave.cancel")}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AttendanceDialog({
  record,
  onClose,
  onSaved,
}: {
  record: AttendanceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const employees = useEmployees(!record);
  const [busy, setBusy] = useState(false);

  const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
  const [form, setForm] = useState({
    employee_id: record?.employee_id || "",
    date: record?.date || new Date().toISOString().slice(0, 10),
    clock_in: toLocalInput(record?.clock_in || null),
    clock_out: toLocalInput(record?.clock_out || null),
    break_minutes: String(record?.break_minutes ?? 0),
    status: record?.status || "present",
    notes: record?.notes || "",
  });
  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.employee_id || !form.date) {
      toast.error(t("attendance.dialog.required"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        date: form.date,
        clock_in: form.clock_in ? new Date(form.clock_in).toISOString() : null,
        clock_out: form.clock_out ? new Date(form.clock_out).toISOString() : null,
        break_minutes: Number(form.break_minutes) || 0,
        status: form.status,
        notes: form.notes || null,
      };
      const res = await fetch(
        record ? `/api/attendance/${record.id}` : "/api/attendance",
        {
          method: record ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("attendance.dialog.save_failed"));
        return;
      }
      toast.success(t("attendance.dialog.saved"));
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!record || !window.confirm(t("attendance.dialog.confirm_delete"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/${record.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("attendance.dialog.deleted"));
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {record ? t("attendance.dialog.edit_title") : t("attendance.dialog.add_title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {record ? (
            <Field label={t("attendance.col.employee")}>
              <Input value={record.employee?.full_name || "—"} disabled />
            </Field>
          ) : (
            <Field label={t("attendance.col.employee")}>
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
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("attendance.col.date")}>
              <Input type="date" value={form.date} onChange={(e) => u("date", e.target.value)} />
            </Field>
            <Field label={t("attendance.col.status")}>
              <select
                value={form.status}
                onChange={(e) => u("status", e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {ATT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("attendance.col.clock_in")}>
              <Input
                type="datetime-local"
                value={form.clock_in}
                onChange={(e) => u("clock_in", e.target.value)}
              />
            </Field>
            <Field label={t("attendance.col.clock_out")}>
              <Input
                type="datetime-local"
                value={form.clock_out}
                onChange={(e) => u("clock_out", e.target.value)}
              />
            </Field>
            <Field label={t("attendance.dialog.break_minutes")}>
              <Input
                type="number"
                value={form.break_minutes}
                onChange={(e) => u("break_minutes", e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("attendance.dialog.notes")}>
            <Input value={form.notes} onChange={(e) => u("notes", e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">{t("attendance.dialog.hours_help")}</p>
        </div>
        <DialogFooter>
          {record && (
            <Button variant="ghost" onClick={del} disabled={busy} className="me-auto text-rose-600">
              <Trash2 className="me-2 h-4 w-4" />
              {t("common.delete")}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("attendance.dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const employees = useEmployees(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "vacation",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.employee_id) {
      toast.error(t("attendance.dialog.required"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("attendance.dialog.save_failed"));
        return;
      }
      toast.success(t("attendance.leave.created"));
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("attendance.leave.new_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("attendance.col.employee")}>
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
            <Field label={t("attendance.col.leave_type")}>
              <select
                value={form.leave_type}
                onChange={(e) => u("leave_type", e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {LEAVE_TYPES.map((lt) => (
                  <option key={lt} value={lt}>
                    {lt}
                  </option>
                ))}
              </select>
            </Field>
            <div />
            <Field label={t("attendance.dialog.start_date")}>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => u("start_date", e.target.value)}
              />
            </Field>
            <Field label={t("attendance.dialog.end_date")}>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => u("end_date", e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("attendance.dialog.reason")}>
            <Input value={form.reason} onChange={(e) => u("reason", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("attendance.leave.submit")}
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

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      {msg}
    </div>
  );
}
