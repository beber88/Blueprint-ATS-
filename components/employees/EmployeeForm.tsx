"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/context";
import { Department, Employee, EmploymentStatus } from "@/types/employees";
import { toast } from "sonner";

interface Props {
  initial?: Partial<Employee>;
  onSaved: (employee: Employee) => void;
  onCancel?: () => void;
}

const STATUS_OPTIONS: EmploymentStatus[] = [
  "active",
  "probation",
  "on_leave",
  "terminated",
  "resigned",
];

export function EmployeeForm({ initial, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: initial?.full_name || "",
    employee_code: initial?.employee_code || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    position: initial?.position || initial?.role || "",
    department_id: initial?.department_id || "",
    hire_date: initial?.hire_date || "",
    birth_date: initial?.date_of_birth || "",
    address: initial?.address || "",
    employment_status: (initial?.employment_status || "active") as EmploymentStatus,
    sss_no: initial?.government_ids?.sss_no || "",
    philhealth_no: initial?.government_ids?.philhealth_no || "",
    pagibig_no: initial?.government_ids?.pagibig_no || "",
    tin: initial?.government_ids?.tin || "",
    emergency_name: initial?.emergency_contact?.name || "",
    emergency_phone: initial?.emergency_contact?.phone || "",
    emergency_relationship: initial?.emergency_contact?.relationship || "",
    notes: initial?.notes || "",
  });

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []))
      .catch(() => setDepartments([]));
  }, []);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error(t("employees.form.name_required"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        employee_code: form.employee_code || null,
        email: form.email || null,
        phone: form.phone || null,
        position: form.position || null,
        department_id: form.department_id || null,
        hire_date: form.hire_date || null,
        birth_date: form.birth_date || null,
        address: form.address || null,
        employment_status: form.employment_status,
        government_ids: {
          sss_no: form.sss_no || null,
          philhealth_no: form.philhealth_no || null,
          pagibig_no: form.pagibig_no || null,
          tin: form.tin || null,
        },
        emergency_contact: {
          name: form.emergency_name || null,
          phone: form.emergency_phone || null,
          relationship: form.emergency_relationship || null,
        },
        notes: form.notes || null,
      };

      const url = initial?.id ? `/api/employees/${initial.id}` : "/api/employees";
      const method = initial?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("employees.toast.save_failed"));
        return;
      }

      const employee: Employee = await res.json();
      toast.success(initial?.id ? t("employees.toast.updated") : t("employees.toast.created"));
      onSaved(employee);
    } catch (err) {
      console.error(err);
      toast.error(t("employees.toast.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title={t("employees.form.section.basic")}>
        <Field label={t("employees.form.full_name") + " *"}>
          <Input
            value={form.full_name}
            onChange={(e) => setField("full_name", e.target.value)}
            required
          />
        </Field>
        <Field label={t("employees.form.employee_code")}>
          <Input
            value={form.employee_code}
            onChange={(e) => setField("employee_code", e.target.value)}
            placeholder="EMP-001"
          />
        </Field>
        <Field label={t("employees.form.email")}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        </Field>
        <Field label={t("employees.form.phone")}>
          <Input
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t("employees.form.section.employment")}>
        <Field label={t("employees.form.position")}>
          <Input value={form.position} onChange={(e) => setField("position", e.target.value)} />
        </Field>
        <Field label={t("employees.form.department")}>
          <Select
            value={form.department_id || "__none__"}
            onValueChange={(v) => setField("department_id", v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("employees.form.department")} />
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
        </Field>
        <Field label={t("employees.form.hire_date")}>
          <Input
            type="date"
            value={form.hire_date}
            onChange={(e) => setField("hire_date", e.target.value)}
          />
        </Field>
        <Field label={t("employees.form.employment_status")}>
          <Select
            value={form.employment_status}
            onValueChange={(v) => setField("employment_status", v as EmploymentStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`employees.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title={t("employees.form.section.personal")}>
        <Field label={t("employees.form.birth_date")}>
          <Input
            type="date"
            value={form.birth_date}
            onChange={(e) => setField("birth_date", e.target.value)}
          />
        </Field>
        <Field label={t("employees.form.address")} wide>
          <Input value={form.address} onChange={(e) => setField("address", e.target.value)} />
        </Field>
      </Section>

      <Section title={t("employees.form.section.government_ids")}>
        <Field label="SSS #">
          <Input value={form.sss_no} onChange={(e) => setField("sss_no", e.target.value)} />
        </Field>
        <Field label="PhilHealth #">
          <Input
            value={form.philhealth_no}
            onChange={(e) => setField("philhealth_no", e.target.value)}
          />
        </Field>
        <Field label="Pag-IBIG #">
          <Input
            value={form.pagibig_no}
            onChange={(e) => setField("pagibig_no", e.target.value)}
          />
        </Field>
        <Field label="TIN">
          <Input value={form.tin} onChange={(e) => setField("tin", e.target.value)} />
        </Field>
      </Section>

      <Section title={t("employees.form.section.emergency")}>
        <Field label={t("employees.form.emergency_name")}>
          <Input
            value={form.emergency_name}
            onChange={(e) => setField("emergency_name", e.target.value)}
          />
        </Field>
        <Field label={t("employees.form.emergency_phone")}>
          <Input
            value={form.emergency_phone}
            onChange={(e) => setField("emergency_phone", e.target.value)}
          />
        </Field>
        <Field label={t("employees.form.emergency_relationship")} wide>
          <Input
            value={form.emergency_relationship}
            onChange={(e) => setField("emergency_relationship", e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t("employees.form.section.notes")}>
        <Field label={t("employees.form.notes")} wide>
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
