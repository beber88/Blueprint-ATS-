"use client";

import { useEffect, useMemo, useState } from "react";
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
  role_level: number;
  is_pm: boolean;
  is_active: boolean;
  department_id: string | null;
  project_id: string | null;
  department?: { name: string; name_he: string | null } | null;
  project?: { name: string } | null;
}
interface Dept { id: string; name: string; name_he: string | null }
interface Proj { id: string; name: string }

const ROLE_LEVELS = [10, 20, 30, 40, 50] as const;

const ROLE_BADGE_COLORS: Record<number, { background: string; color: string } | null> = {
  10: { background: "#5B3F9E20", color: "#5B3F9E" },
  20: { background: "#1A56A820", color: "#1A56A8" },
  30: { background: "#C9A84C20", color: "#C9A84C" },
  40: { background: "#2D7A3E20", color: "#2D7A3E" },
  50: null,
};

function RoleLevelBadge({ level, t }: { level: number; t: (key: string) => string }) {
  const colors = ROLE_BADGE_COLORS[level];
  if (!colors) return null;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      background: colors.background,
      color: colors.color,
      marginInlineStart: 6,
    }}>
      {t(`operations.role_level.${level}`)}
    </span>
  );
}

export default function EmployeesPage() {
  const { t } = useI18n();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", whatsapp_phone: "", email: "", role: "", role_level: "50", department_id: "", project_id: "", is_pm: false });
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

  // Group employees by department
  const groupedByDept = useMemo(() => {
    const groups: { key: string; label: string; employees: Emp[] }[] = [];
    const deptMap = new Map<string, { label: string; employees: Emp[] }>();
    const noDept: Emp[] = [];

    for (const emp of emps) {
      const deptName = emp.department?.name_he || emp.department?.name;
      if (deptName && emp.department_id) {
        let group = deptMap.get(emp.department_id);
        if (!group) {
          group = { label: deptName, employees: [] };
          deptMap.set(emp.department_id, group);
        }
        group.employees.push(emp);
      } else {
        noDept.push(emp);
      }
    }

    // Sort employees within each group by role_level then full_name
    const sortEmps = (a: Emp, b: Emp) => {
      const levelDiff = (a.role_level ?? 50) - (b.role_level ?? 50);
      if (levelDiff !== 0) return levelDiff;
      return a.full_name.localeCompare(b.full_name);
    };

    for (const [key, group] of Array.from(deptMap.entries())) {
      group.employees.sort(sortEmps);
      groups.push({ key, label: group.label, employees: group.employees });
    }

    // Sort department groups alphabetically
    groups.sort((a, b) => a.label.localeCompare(b.label));

    // Add "No Department" group at the bottom
    if (noDept.length > 0) {
      noDept.sort(sortEmps);
      groups.push({ key: "__no_dept__", label: t("operations.item_detail.no_dept"), employees: noDept });
    }

    return groups;
  }, [emps, t]);

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
          role_level: parseInt(form.role_level, 10),
          department_id: form.department_id || null,
          project_id: form.project_id || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("operations.toast.employee_created"));
      setForm({ full_name: "", phone: "", whatsapp_phone: "", email: "", role: "", role_level: "50", department_id: "", project_id: "", is_pm: false });
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

  const totalEmps = emps.length;

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
            <select value={form.role_level} onChange={(e) => setForm({ ...form, role_level: e.target.value })} style={inputStyle}>
              {ROLE_LEVELS.map((lvl) => (
                <option key={lvl} value={String(lvl)}>{t(`operations.role_level.${lvl}`)}</option>
              ))}
            </select>
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
        ) : totalEmps === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("operations.empty.no_employees")}</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.full_name")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.role")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.col.project")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.whatsapp_phone")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.is_pm")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.employees.is_active")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groupedByDept.map((group) => (
                <>
                  {/* Department header row */}
                  <tr key={`dept-header-${group.key}`}>
                    <td
                      colSpan={7}
                      style={{
                        padding: "10px 12px 6px",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--text-primary)",
                        background: "var(--bg-secondary, #f5f5f5)",
                        borderBottom: "2px solid var(--border-light)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {group.label}
                      <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-secondary)", marginInlineStart: 8 }}>
                        ({group.employees.length})
                      </span>
                    </td>
                  </tr>
                  {group.employees.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border-light)", opacity: e.is_active ? 1 : 0.5 }}>
                      <td style={{ padding: "8px 12px" }}>
                        {e.full_name}
                        <RoleLevelBadge level={e.role_level ?? 50} t={t} />
                      </td>
                      <td style={{ padding: "8px 12px" }}>{e.role || "\u2014"}</td>
                      <td style={{ padding: "8px 12px" }}>{e.project?.name || "\u2014"}</td>
                      <td style={{ padding: "8px 12px", direction: "ltr" }}>{e.whatsapp_phone || e.phone || "\u2014"}</td>
                      <td style={{ padding: "8px 12px" }}>{e.is_pm ? "\u2713" : ""}</td>
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
                </>
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
