"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  source: string;
  created_at: string;
  employee?: { full_name: string; department_id: string | null } | null;
}

interface Employee {
  id: string;
  full_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  cancelled: "#6B7280",
};

export default function LeavePage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", leave_type: "vacation", start_date: "", end_date: "", reason: "",
  });

  const load = async () => {
    setLoading(true);
    const [lr, er] = await Promise.all([
      fetch("/api/hr/leave").then((r) => r.json()),
      fetch("/api/operations/employees").then((r) => r.json()),
    ]);
    setRequests(lr.requests || []);
    setEmployees(er.employees || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) return;
    setBusy(true);
    try {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, days_count: days }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      setShowForm(false);
      setForm({ employee_id: "", leave_type: "vacation", start_date: "", end_date: "", reason: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/hr/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(t("common.updated_success"));
      load();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;

  const leaveTypes = ["vacation", "sick", "personal", "maternity", "paternity", "unpaid", "bereavement", "emergency"];

  return (
    <OpsPageShell
      title={t("hr_mgmt.leave.title")}
      subtitle={t("hr_mgmt.leave.subtitle")}
      actions={
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
          {t("hr_mgmt.leave.new_request")}
        </button>
      }
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("hr_mgmt.leave.pending")} value={pendingCount} accent="#F59E0B" />
        <KpiCard label={t("hr_mgmt.leave.approved")} value={approvedCount} accent="#10B981" />
        <KpiCard label={t("hr_mgmt.leave.total")} value={requests.length} accent="#C9A84C" />
      </div>

      {/* New request form */}
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            >
              <option value="">Select Employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            <select
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            >
              {leaveTypes.map((lt) => <option key={lt} value={lt}>{t(`hr_mgmt.leave.${lt}`)}</option>)}
            </select>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <input
              placeholder={t("hr_mgmt.leave.reason")}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
            <button
              onClick={create}
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

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["all", "pending", "approved", "rejected", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer",
              background: filter === f ? "rgba(201,168,76,0.15)" : "var(--bg-card)",
              color: filter === f ? "#C9A84C" : "var(--text-secondary)",
              borderWidth: 1, borderStyle: "solid",
              borderColor: filter === f ? "rgba(201,168,76,0.35)" : "var(--border-light)",
            }}
          >
            {f === "all" ? t("hr_mgmt.email_inbox.all") : t(`hr_mgmt.leave.${f}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : filtered.length === 0 ? (
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            {t("hr_mgmt.leave.no_requests")}
          </p>
        </OpsCard>
      ) : (
        <OpsCard>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Employee</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.leave.start_date")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.leave.end_date")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.leave.days")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.leave.reason")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "8px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const emp = employees.find((e) => e.id === req.employee_id);
                return (
                  <tr key={req.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {emp?.full_name || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
                      {t(`hr_mgmt.leave.${req.leave_type}`)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {format(new Date(req.start_date), "MMM d, yyyy")}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {format(new Date(req.end_date), "MMM d, yyyy")}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
                      {req.days_count}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {req.reason || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: `${STATUS_COLORS[req.status] || "#6B7280"}20`,
                        color: STATUS_COLORS[req.status] || "#6B7280",
                      }}>
                        {t(`hr_mgmt.leave.${req.status}`)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {req.status === "pending" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => updateStatus(req.id, "approved")}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#10B981" }}
                            title={t("hr_mgmt.leave.approve")}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => updateStatus(req.id, "rejected")}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444" }}
                            title={t("hr_mgmt.leave.reject")}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
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
