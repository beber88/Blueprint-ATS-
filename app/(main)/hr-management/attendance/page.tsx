"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status: string;
  notes: string | null;
}

interface Employee {
  id: string;
  full_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  present: "#10B981",
  absent: "#EF4444",
  late: "#F59E0B",
  half_day: "#3B82F6",
  leave: "#8B5CF6",
  holiday: "#6B7280",
  rest_day: "#6B7280",
};

export default function AttendancePage() {
  const { t } = useI18n();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [clockForm, setClockForm] = useState({ employee_id: "", action: "clock_in" as "clock_in" | "clock_out" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [ar, er] = await Promise.all([
      fetch(`/api/hr/attendance?date=${selectedDate}`).then((r) => r.json()),
      fetch("/api/operations/employees").then((r) => r.json()),
    ]);
    setRecords(ar.records || []);
    setEmployees(er.employees || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedDate]);

  const clockAction = async () => {
    if (!clockForm.employee_id) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hr/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: clockForm.employee_id,
          action: clockForm.action,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      setClockForm({ employee_id: "", action: "clock_in" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;

  return (
    <OpsPageShell
      title={t("hr_mgmt.attendance.title")}
      subtitle={t("hr_mgmt.attendance.subtitle")}
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("hr_mgmt.attendance.present")} value={presentCount} accent="#10B981" />
        <KpiCard label={t("hr_mgmt.attendance.absent")} value={absentCount} accent="#EF4444" />
        <KpiCard label={t("hr_mgmt.attendance.late")} value={lateCount} accent="#F59E0B" />
        <KpiCard label={t("hr_mgmt.attendance.total_hours")} value={records.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1)} accent="#C9A84C" />
      </div>

      {/* Clock in/out form */}
      <OpsCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={clockForm.employee_id}
            onChange={(e) => setClockForm({ ...clockForm, employee_id: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, minWidth: 200 }}
          >
            <option value="">Select Employee</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => { setClockForm({ ...clockForm, action: "clock_in" }); clockAction(); }}
              disabled={busy || !clockForm.employee_id}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 6,
                background: "#10B981", color: "#fff",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                opacity: !clockForm.employee_id ? 0.5 : 1,
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              {t("hr_mgmt.attendance.clock_in")}
            </button>
            <button
              onClick={() => { setClockForm({ ...clockForm, action: "clock_out" }); clockAction(); }}
              disabled={busy || !clockForm.employee_id}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 6,
                background: "#EF4444", color: "#fff",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                opacity: !clockForm.employee_id ? 0.5 : 1,
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              {t("hr_mgmt.attendance.clock_out")}
            </button>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, marginLeft: "auto" }}
          />
        </div>
      </OpsCard>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : (
        <OpsCard>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Employee</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.attendance.clock_in")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.attendance.clock_out")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.attendance.total_hours")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.attendance.overtime")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                    No attendance records for this date
                  </td>
                </tr>
              ) : records.map((rec) => {
                const emp = employees.find((e) => e.id === rec.employee_id);
                return (
                  <tr key={rec.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {emp?.full_name || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: `${STATUS_COLORS[rec.status] || "#6B7280"}20`,
                        color: STATUS_COLORS[rec.status] || "#6B7280",
                      }}>
                        {t(`hr_mgmt.attendance.${rec.status === "leave" ? "on_leave" : rec.status}`)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {rec.clock_in ? format(new Date(rec.clock_in), "HH:mm") : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {rec.clock_out ? format(new Date(rec.clock_out), "HH:mm") : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 500 }}>
                      {rec.total_hours?.toFixed(1) || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: rec.overtime_hours ? "#F59E0B" : "var(--text-secondary)" }}>
                      {rec.overtime_hours?.toFixed(1) || "0.0"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rec.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </OpsCard>
      )}
    </OpsPageShell>
  );
}
