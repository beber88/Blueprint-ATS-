"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DepartmentTree } from "@/components/employees/DepartmentTree";
import { useI18n } from "@/lib/i18n/context";
import { Department } from "@/types/employees";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const { t } = useI18n();
  const [departments, setDepartments] = useState<(Department & { employee_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    name_en: "",
    name_he: "",
    name_tl: "",
    description: "",
    parent_department_id: "",
  });

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      setDepartments(data.departments || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t("departments.name_required"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          name_en: form.name_en || form.name,
          name_he: form.name_he || null,
          name_tl: form.name_tl || null,
          description: form.description || null,
          parent_department_id: form.parent_department_id || null,
        }),
      });
      if (!res.ok) {
        toast.error(t("departments.create_failed"));
        return;
      }
      toast.success(t("departments.created"));
      setOpen(false);
      setForm({ name: "", name_en: "", name_he: "", name_tl: "", description: "", parent_department_id: "" });
      fetchDepartments();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("departments.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("departments.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("departments.add")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <DepartmentTree departments={departments} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("departments.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("departments.form.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">EN</Label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">HE</Label>
                <Input
                  value={form.name_he}
                  onChange={(e) => setForm({ ...form, name_he: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">TL</Label>
                <Input
                  value={form.name_tl}
                  onChange={(e) => setForm({ ...form, name_tl: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("departments.form.parent")}</Label>
              <Select
                value={form.parent_department_id || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, parent_department_id: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("departments.form.description")}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t("common.saving") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
