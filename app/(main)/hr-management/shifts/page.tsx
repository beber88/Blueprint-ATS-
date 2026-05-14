"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

interface ShiftDefinition {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color?: string;
  description?: string | null;
}

interface ShiftAssignment {
  id: string;
  employee_id: string;
  employee_name?: string;
  shift_id: string;
  shift_name?: string;
  date: string;
  status?: string;
}

type View = "definitions" | "calendar";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ShiftsPage() {
  const { t } = useI18n();
  const [definitions, setDefinitions] = useState<ShiftDefinition[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("definitions");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ name: "", start_time: "08:00", end_time: "16:00", break_minutes: 60 });

  const load = async () => {
    setLoading(true);
    const [dr, ar] = await Promise.all([
      fetch("/api/hr/shifts/definitions").then((r) => r.json()),
      fetch("/api/hr/shifts/assignments").then((r) => r.json()),
    ]);
    setDefinitions(dr.definitions || dr.shifts || []);
    setAssignments(ar.assignments || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createShift = async () => {
    if (!form.name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hr/shifts/definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      setShowForm(false);
      setForm({ name: "", start_time: "08:00", end_time: "16:00", break_minutes: 60 });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  // Build week dates for calendar view
  const getWeekDates = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  };

  const weekDates = getWeekDates();

  // Group assignments by employee for calendar
  const employeeMap = new Map<string, { name: string; shifts: Map<string, ShiftAssignment> }>();
  assignments.forEach((a) => {
    if (!employeeMap.has(a.employee_id)) {
      employeeMap.set(a.employee_id, { name: a.employee_name || a.employee_id, shifts: new Map() });
    }
    employeeMap.get(a.employee_id)!.shifts.set(a.date, a);
  });

  return (
    <OpsPageShell
      title={t("hr_mgmt.shifts.title")}
      subtitle={t("hr_mgmt.shifts.subtitle")}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: "#C9A84C", color: "#1A1A1A",
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} />
            {t("hr_mgmt.shifts.new_shift")}
          </button>
        </div>
      }
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Shift Types" value={definitions.length} accent="#C9A84C" />
        <KpiCard label="Assignments" value={assignments.length} accent="#3B82F6" />
        <KpiCard label="Employees Scheduled" value={employeeMap.size} accent="#10B981" />
      </div>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["definitions", "calendar"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer",
              background: view === v ? "rgba(201,168,76,0.15)" : "var(--bg-card)",
              color: view === v ? "#C9A84C" : "var(--text-secondary)",
              borderWidth: 1, borderStyle: "solid",
              borderColor: view === v ? "rgba(201,168,76,0.35)" : "var(--border-light)",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {v === "calendar" && <Calendar size={12} />}
            {v === "definitions" ? "Shift Definitions" : "Schedule Calendar"}
          </button>
        ))}
      </div>

      {/* New shift form */}
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <input
              placeholder="Shift Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <input
              type="number"
              placeholder="Break (min)"
              value={form.break_minutes}
              onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <button
              onClick={createShift}
              disabled={busy}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: "#C9A84C", color: "#1A1A1A", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
            </button>
          </div>
        </OpsCard>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : view === "definitions" ? (
        definitions.length === 0 ? (
          <OpsCard>
            <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              {t("hr_mgmt.shifts.no_shifts")}
            </p>
          </OpsCard>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {definitions.map((def) => (
              <OpsCard key={def.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: def.color || "#C9A84C" }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{def.name}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                  {def.start_time} - {def.end_time}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Break: {def.break_minutes} min
                </div>
                {def.description && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{def.description}</div>
                )}
              </OpsCard>
            ))}
          </div>
        )
      ) : (
        /* Calendar View */
        <OpsCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              style={{ background: "none", border: "1px solid var(--border-light)", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "var(--text-primary)", fontSize: 12 }}
            >
              &larr; Prev
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {weekDates[0]} &mdash; {weekDates[6]}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              style={{ background: "none", border: "1px solid var(--border-light)", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "var(--text-primary)", fontSize: 12 }}
            >
              Next &rarr;
            </button>
          </div>
          {employeeMap.size === 0 ? (
            <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>No shift assignments found</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500, minWidth: 120 }}>Employee</th>
                    {weekDates.map((d, i) => (
                      <th key={d} style={{ textAlign: "center", padding: "8px 6px", color: "var(--text-secondary)", fontWeight: 500 }}>
                        <div>{DAY_LABELS[i]}</div>
                        <div style={{ fontSize: 10 }}>{d.slice(5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(employeeMap.entries()).map(([empId, { name, shifts }]) => (
                    <tr key={empId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 500, color: "var(--text-primary)" }}>{name}</td>
                      {weekDates.map((d) => {
                        const shift = shifts.get(d);
                        const def = shift ? definitions.find((df) => df.id === shift.shift_id) : null;
                        return (
                          <td key={d} style={{ padding: "4px 4px", textAlign: "center" }}>
                            {shift ? (
                              <span style={{
                                display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                                background: `${def?.color || "#C9A84C"}20`,
                                color: def?.color || "#C9A84C",
                              }}>
                                {shift.shift_name || def?.name || "Shift"}
                              </span>
                            ) : (
                              <span style={{ color: "var(--border-light)" }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </OpsCard>
      )}
    </OpsPageShell>
  );
}
