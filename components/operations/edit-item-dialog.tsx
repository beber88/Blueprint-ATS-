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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Item {
  id: string;
  issue: string;
  status: string;
  priority: string;
  category: string;
  deadline: string | null;
  ceo_decision_needed: boolean;
  missing_information: string | null;
  next_action: string | null;
  person_responsible_id?: string | null;
  department_id?: string | null;
  project_id?: string | null;
}

interface Emp { id: string; full_name: string }
interface Dept { id: string; name: string; name_he: string | null }
interface Proj { id: string; name: string }

interface Props {
  open: boolean;
  item: Item;
  employees: Emp[];
  departments: Dept[];
  projects: Proj[];
  onClose: () => void;
  onUpdated: () => void;
}

const CATEGORIES = ["hr", "attendance", "safety", "project", "permit", "procurement", "subcontractor", "site", "other"];

export function EditItemDialog({ open, item, employees, departments, projects, onClose, onUpdated }: Props) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    issue: "",
    status: "open",
    priority: "medium",
    category: "other",
    deadline: "",
    next_action: "",
    missing_information: "",
    ceo_decision_needed: false,
    person_responsible_id: "",
    department_id: "",
    project_id: "",
  });

  useEffect(() => {
    if (open && item) {
      setForm({
        issue: item.issue || "",
        status: item.status || "open",
        priority: item.priority || "medium",
        category: item.category || "other",
        deadline: item.deadline || "",
        next_action: item.next_action || "",
        missing_information: item.missing_information || "",
        ceo_decision_needed: item.ceo_decision_needed,
        person_responsible_id: item.person_responsible_id || "",
        department_id: item.department_id || "",
        project_id: item.project_id || "",
      });
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        issue: form.issue,
        status: form.status,
        priority: form.priority,
        category: form.category,
        deadline: form.deadline || null,
        next_action: form.next_action || null,
        missing_information: form.missing_information || null,
        ceo_decision_needed: form.ceo_decision_needed,
        person_responsible_id: form.person_responsible_id || null,
        department_id: form.department_id || null,
        project_id: form.project_id || null,
      };
      const res = await fetch(`/api/operations/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("operations.toast.item_updated"));
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const isRTL = locale === "he";
  const dateStyle: React.CSSProperties = isRTL ? { direction: "ltr" } : {};

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>{t("common.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>{t("operations.col.issue")}</label>
              <Textarea value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} rows={2} />
            </div>

            <div>
              <label style={labelStyle}>{t("operations.col.status")}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={selectStyle}>
                <option value="open">{t("operations.status.open")}</option>
                <option value="in_progress">{t("operations.status.in_progress")}</option>
                <option value="blocked">{t("operations.status.blocked")}</option>
                <option value="resolved">{t("operations.status.resolved")}</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t("operations.col.priority")}</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={selectStyle}>
                <option value="low">{t("operations.priority.low")}</option>
                <option value="medium">{t("operations.priority.medium")}</option>
                <option value="high">{t("operations.priority.high")}</option>
                <option value="urgent">{t("operations.priority.urgent")}</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t("operations.col.deadline")}</label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>{t("operations.col.responsible")}</label>
              <select value={form.person_responsible_id} onChange={(e) => setForm({ ...form, person_responsible_id: e.target.value })} style={selectStyle}>
                <option value="">—</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t("operations.col.dept")}</label>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} style={selectStyle}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name_he || d.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t("operations.col.project")}</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} style={selectStyle}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Next action</label>
              <Textarea value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} rows={2} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Missing information</label>
              <Textarea value={form.missing_information} onChange={(e) => setForm({ ...form, missing_information: e.target.value })} rows={2} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <input type="checkbox" checked={form.ceo_decision_needed} onChange={(e) => setForm({ ...form, ceo_decision_needed: e.target.checked })} id="edit_ceo" />
              <label htmlFor="edit_ceo" style={{ fontSize: 13, color: "var(--text-primary)" }}>{t("operations.flag.ceo")}</label>
            </div>
          </div>

          <DialogFooter style={{ marginTop: 16 }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
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
