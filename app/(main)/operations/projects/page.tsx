"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Project { id: string; name: string; code: string | null; status: string; department_id: string | null; started_at: string | null; notes: string | null; department?: { name: string; name_he?: string; color?: string } | null }
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

  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", status: "active", department_id: "", started_at: "", notes: "" });
  const [editBusy, setEditBusy] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const openEdit = (p: Project) => {
    setEditProject(p);
    setEditForm({
      name: p.name,
      code: p.code || "",
      status: p.status,
      department_id: p.department_id || "",
      started_at: p.started_at ? p.started_at.slice(0, 10) : "",
      notes: p.notes || "",
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editProject || !editForm.name.trim()) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/operations/projects/${editProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code || null,
          status: editForm.status,
          department_id: editForm.department_id || null,
          started_at: editForm.started_at || null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.success"));
      setEditOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/operations/projects/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.success"));
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDeleteBusy(false);
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
                <th style={{ padding: "8px 12px", textAlign: "center", width: 80 }}>{t("common.actions")}</th>
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
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-secondary)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--red, #EF4444)" }}>
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

      <Dialog open={editOpen} onOpenChange={(v) => !v && setEditOpen(false)}>
        <DialogContent style={{ maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("operations.projects.name")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("operations.projects.code")}</Label>
                <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("operations.col.status")}</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("operations.projects.status.active")}</SelectItem>
                    <SelectItem value="paused">{t("operations.projects.status.paused")}</SelectItem>
                    <SelectItem value="completed">{t("operations.projects.status.completed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("operations.col.dept")}</Label>
                <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder={t("operations.projects.no_department")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t("operations.projects.no_department")}</SelectItem>
                    {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name_he || d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("operations.projects.started_at")}</Label>
                <Input type="date" value={editForm.started_at} onChange={(e) => setEditForm({ ...editForm, started_at: e.target.value })} className="rounded-lg" style={{ direction: "ltr" }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("interviews.form.notes")}</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="rounded-lg resize-none" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg">{t("common.cancel")}</Button>
            <Button onClick={submitEdit} disabled={editBusy} className="rounded-lg text-white" style={{ background: "var(--brand-gold)" }}>
              {editBusy ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        loading={deleteBusy}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </OpsPageShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13,
};
