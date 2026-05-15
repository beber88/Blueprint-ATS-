"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ROLE_LEVELS = [10, 20, 30, 40, 50] as const;

interface Emp {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  role: string | null;
  role_level?: number;
  is_pm: boolean;
  department_id: string | null;
  project_id: string | null;
}

interface Dept { id: string; name: string; name_he: string | null }
interface Proj { id: string; name: string }

interface Props {
  open: boolean;
  employee: Emp;
  departments: Dept[];
  projects: Proj[];
  onClose: () => void;
  onUpdated: () => void;
}

export function EditEmployeeDialog({ open, employee, departments, projects, onClose, onUpdated }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    whatsapp_phone: "",
    email: "",
    role: "",
    role_level: "50",
    department_id: "",
    project_id: "",
    is_pm: false,
  });

  useEffect(() => {
    if (open && employee) {
      setForm({
        full_name: employee.full_name || "",
        phone: employee.phone || "",
        whatsapp_phone: employee.whatsapp_phone || "",
        email: employee.email || "",
        role: employee.role || "",
        role_level: String(employee.role_level ?? 50),
        department_id: employee.department_id || "",
        project_id: employee.project_id || "",
        is_pm: employee.is_pm,
      });
    }
  }, [open, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/employees/${employee.id}`, {
        method: "PATCH",
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
      toast.success(t("common.saved_successfully"));
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>{t("common.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>{t("operations.employees.full_name")}</label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>{t("operations.employees.phone")}</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ direction: "ltr" }} />
            </div>
            <div>
              <label style={labelStyle}>{t("operations.employees.whatsapp_phone")}</label>
              <Input value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} style={{ direction: "ltr" }} />
            </div>
            <div>
              <label style={labelStyle}>{t("operations.employees.email")}</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ direction: "ltr" }} />
            </div>
            <div>
              <label style={labelStyle}>{t("operations.employees.role")}</label>
              <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>{t("operations.role_level.label")}</label>
              <select value={form.role_level} onChange={(e) => setForm({ ...form, role_level: e.target.value })} style={selectStyle}>
                {ROLE_LEVELS.map((lvl) => (
                  <option key={lvl} value={String(lvl)}>{t(`operations.role_level.${lvl}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("operations.col.dept")}</label>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} style={selectStyle}>
                <option value="">{t("operations.employees.no_department")}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name_he || d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("operations.col.project")}</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} style={selectStyle}>
                <option value="">{t("operations.employees.no_project")}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <input type="checkbox" checked={form.is_pm} onChange={(e) => setForm({ ...form, is_pm: e.target.checked })} id="edit_is_pm" />
              <label htmlFor="edit_is_pm" style={{ fontSize: 13, color: "var(--text-primary)" }}>{t("operations.employees.is_pm")}</label>
            </div>
          </div>
          <DialogFooter style={{ marginTop: 16 }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!form.full_name.trim() || loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : t("common.save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-secondary)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border-primary)",
  borderRadius: 6,
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  fontSize: 13,
};
