"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Project { id: string; name: string; code: string | null; status: string; department?: { name: string; name_he?: string; color?: string } | null }
interface Department { id: string; name: string; name_he: string | null }

export default function ProjectsPage() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [deptId, setDeptId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pr, dr] = await Promise.all([
      fetch("/api/operations/projects").then((r) => r.json()),
      fetch("/api/operations/departments").then((r) => r.json()),
    ]);
    setProjects(pr.projects || []);
    setDepts(dr.departments || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/operations/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code || null, department_id: deptId || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("operations.toast.project_created"));
      setName(""); setCode(""); setDeptId(""); setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsPageShell
      title={t("operations.nav.projects")}
      subtitle={t("operations.projects.subtitle")}
      actions={
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 14px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <Plus size={14} />
          {t("operations.projects.new")}
        </button>
      }
    >
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("operations.projects.name")} style={inputStyle} />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("operations.projects.code")} style={inputStyle} />
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={inputStyle}>
              <option value="">{t("operations.projects.no_department")}</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name_he || d.name}</option>)}
            </select>
            <button disabled={busy} onClick={create} style={{ padding: "8px 14px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("operations.actions.create")}
            </button>
          </div>
        </OpsCard>
      )}

      <OpsCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("operations.empty.no_projects")}</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.projects.name")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.projects.code")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.col.dept")}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>{t("operations.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <Link href={`/hr/operations/projects/${p.id}`} style={{ color: "#1A56A8", textDecoration: "none", fontWeight: 500 }}>{p.name}</Link>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{p.code || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{p.department?.name_he || p.department?.name || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{t(`operations.projects.status.${p.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13,
};
