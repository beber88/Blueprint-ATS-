"use client";

import { useEffect, useState } from "react";
import { OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Dept { id: string; code: string; name: string; name_he: string | null; name_en: string | null; name_tl: string | null; color: string | null }

const emptyForm = { code: "", name: "", name_he: "", name_en: "", name_tl: "", color: "#C9A84C" };

export default function DepartmentsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDept, setEditDept] = useState<Dept | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/operations/departments")
      .then((r) => r.json())
      .then((d) => setItems(d.departments || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditDept(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (d: Dept) => {
    setEditDept(d);
    setForm({
      code: d.code || "",
      name: d.name || "",
      name_he: d.name_he || "",
      name_en: d.name_en || "",
      name_tl: d.name_tl || "",
      color: d.color || "#C9A84C",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const url = editDept ? `/api/operations/departments/${editDept.id}` : "/api/operations/departments";
      const method = editDept ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code || null,
          name: form.name.trim(),
          name_he: form.name_he || null,
          name_en: form.name_en || null,
          name_tl: form.name_tl || null,
          color: form.color || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.success"));
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/operations/departments/${deleteId}`, { method: "DELETE" });
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
      title={t("operations.nav.departments")}
      subtitle={t("operations.departments.subtitle")}
      actions={
        <button
          onClick={openCreate}
          style={{ padding: "8px 14px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <Plus size={14} />
          {t("operations.departments.new")}
        </button>
      }
    >
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {items.map((d) => (
            <div
              key={d.id}
              style={{
                display: "block",
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderTop: `3px solid ${d.color || "#C9A84C"}`,
                borderRadius: 10,
                padding: 16,
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 4 }}>
                <button onClick={() => openEdit(d)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-secondary)" }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDeleteId(d.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--red, #EF4444)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <Link
                href={`/hr/operations/departments/${d.id}`}
                style={{ textDecoration: "none", color: "var(--text-primary)" }}
              >
                <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>{d.code}</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{d.name_he || d.name}</div>
              </Link>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle>{editDept ? t("common.edit") : t("operations.departments.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("operations.projects.code")}</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("operations.departments.color")}</Label>
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="rounded-lg" placeholder="#C9A84C" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("operations.projects.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("operations.departments.name_he")}</Label>
              <Input value={form.name_he} onChange={(e) => setForm({ ...form, name_he: e.target.value })} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("operations.departments.name_en")}</Label>
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("operations.departments.name_tl")}</Label>
              <Input value={form.name_tl} onChange={(e) => setForm({ ...form, name_tl: e.target.value })} className="rounded-lg" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">{t("common.cancel")}</Button>
            <Button onClick={submit} disabled={busy} className="rounded-lg text-white" style={{ background: "var(--brand-gold)" }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
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
