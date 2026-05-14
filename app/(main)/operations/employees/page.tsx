"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditEmployeeDialog } from "@/components/operations/edit-employee-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

interface Emp {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  role: string | null;
  is_pm: boolean;
  is_active: boolean;
  department_id: string | null;
  project_id: string | null;
  department?: { name: string; name_he: string | null } | null;
  project?: { name: string } | null;
}
interface Dept { id: string; name: string; name_he: string | null }
interface Proj { id: string; name: string }

export default function EmployeesPage() {
  const { t } = useI18n();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", whatsapp_phone: "", email: "", role: "", department_id: "", project_id: "", is_pm: false });
  const [editTarget, setEditTarget] = useState<Emp | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Emp | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [er, dr, pr] = await Promise.all([
      fetch("/api/operations/employees?include_inactive=true").then((r) => r.json()),
      fetch("/api/operations/departments").then((r) => r.json()),
      fetch("/api/operations/projects").then((r) => r.json()),
    ]);
    setEmps(er.employees || []);
    setDepts(dr.departments || []);
    setProjects(pr.projects || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.full_name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/operations/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          full_name: form.full_name.trim(),
          department_id: form.department_id || null,
          project_id: form.project_id || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("operations.toast.employee_created"));
      setForm({ full_name: "", phone: "", whatsapp_phone: "", email: "", role: "", department_id: "", project_id: "", is_pm: false });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (e: Emp, active: boolean) => {
    await fetch(`/api/operations/employees/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/operations/employees/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.delete"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <OpsPageShell
      title={t("operations.nav.employees")}
      subtitle={t("operations.employees.subtitle")}
      actions={
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 14px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <Plus size={14} /> {t("operations.employees.new")}
        </button>
      }
    >
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder={t("operations.employees.full_name")} style={inputStyle} />
            <input value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} placeholder={t("operations.employees.whatsapp_phone")} style={inputStyle} />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("operations.employees.phone")} style={inputStyle} />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("operations.employees.email")} style={inputStyle} />
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={t("operations.employees.role")} style={inputStyle} />
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} style={inputStyle}>
              <option value="">{t("operations.employees.no_department")}</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name_he || d.name}</option>)}
            </select>
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} style={inputStyle}>
              <option value="">{t("operations.employees.no_project")}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13 }}>
              <input type="checkbox" checked={form.is_pm} onChange={(e) => setForm({ ...form, is_pm: e.target.checked })} />
              {t("operations.employees.is_pm")}
            </label>
            <button disabled={busy} onClick={create} style={{ padding: "8px 14px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("operations.actions.create")}
            </button>
          </div>
        </OpsCard>
      )}

      <OpsCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
        ) : emps.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("operations.empty.no_employees")}</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.full_name")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.role")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.col.dept")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.col.project")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.whatsapp_phone")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.is_pm")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.is_active")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {emps.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border-light)", opacity: e.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: "8px 12px" }}>{e.full_name}</td>
                  <td style={{ padding: "8px 12px" }}>{e.role || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{e.department?.name_he || e.department?.name || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{e.project?.name || "—"}</td>
                  <td style={{ padding: "8px 12px", direction: "ltr" }}>{e.whatsapp_phone || e.phone || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{e.is_pm ? "✓" : ""}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <input type="checkbox" checked={e.is_active} onChange={(ev) => toggleActive(e, ev.target.checked)} />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setEditTarget(e)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4 }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(e)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A32D2D", padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>
      {editTarget && (
        <EditEmployeeDialog
          open={!!editTarget}
          employee={editTarget}
          departments={depts}
          projects={projects}
          onClose={() => setEditTarget(null)}
          onUpdated={load}
        />
      )}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title={t("common.confirm_delete_title")}
        message={t("common.confirm_delete_message")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
    </OpsPageShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13,
};
