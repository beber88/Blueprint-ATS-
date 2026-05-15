"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n/context";
import { Employee } from "@/types/employees";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeDocumentList } from "./EmployeeDocumentList";
import { EmployeeTimeline } from "./EmployeeTimeline";
import { formatDate } from "@/lib/utils";
import { Mail, Phone, MapPin, Building2, Briefcase, Calendar, IdCard } from "lucide-react";

interface Props {
  employee: Employee;
  onChanged: () => void;
}

export function EmployeeProfileTabs({ employee, onChanged }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList>
        <TabsTrigger value="overview">{t("employees.tabs.overview")}</TabsTrigger>
        <TabsTrigger value="documents">
          {t("employees.tabs.documents")}
          {employee.documents && employee.documents.length > 0 && (
            <span className="ms-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
              {employee.documents.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="timeline">{t("employees.tabs.timeline")}</TabsTrigger>
        <TabsTrigger value="edit">{t("employees.tabs.edit")}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Section title={t("employees.section.contact")}>
            <Row icon={Mail} label={t("employees.form.email")} value={employee.email} />
            <Row icon={Phone} label={t("employees.form.phone")} value={employee.phone} />
            <Row icon={MapPin} label={t("employees.form.address")} value={employee.address} />
          </Section>

          <Section title={t("employees.section.employment")}>
            <Row icon={Briefcase} label={t("employees.form.position")} value={employee.position || employee.role} />
            <Row
              icon={Building2}
              label={t("employees.form.department")}
              value={employee.department?.name}
            />
            <Row
              icon={Calendar}
              label={t("employees.form.hire_date")}
              value={employee.hire_date ? formatDate(employee.hire_date) : null}
            />
            <Row
              icon={IdCard}
              label={t("employees.form.employee_code")}
              value={employee.employee_code}
            />
          </Section>

          <Section title={t("employees.section.government_ids")}>
            <Row label="SSS" value={employee.government_ids?.sss_no} />
            <Row label="PhilHealth" value={employee.government_ids?.philhealth_no} />
            <Row label="Pag-IBIG" value={employee.government_ids?.pagibig_no} />
            <Row label="TIN" value={employee.government_ids?.tin} />
          </Section>

          <Section title={t("employees.section.emergency_contact")}>
            <Row label={t("employees.form.emergency_name")} value={employee.emergency_contact?.name} />
            <Row label={t("employees.form.emergency_phone")} value={employee.emergency_contact?.phone} />
            <Row
              label={t("employees.form.emergency_relationship")}
              value={employee.emergency_contact?.relationship}
            />
          </Section>
        </div>

        {employee.notes && (
          <Section title={t("employees.section.notes")}>
            <p className="whitespace-pre-wrap text-sm">{employee.notes}</p>
          </Section>
        )}
      </TabsContent>

      <TabsContent value="documents" className="mt-6">
        <EmployeeDocumentList
          employeeId={employee.id}
          documents={employee.documents || []}
          onChanged={onChanged}
        />
      </TabsContent>

      <TabsContent value="timeline" className="mt-6">
        <EmployeeTimeline events={employee.timeline || []} />
      </TabsContent>

      <TabsContent value="edit" className="mt-6">
        <EmployeeForm
          initial={employee}
          onSaved={() => {
            setTab("overview");
            onChanged();
          }}
          onCancel={() => setTab("overview")}
        />
      </TabsContent>
    </Tabs>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

interface RowProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null | undefined;
}

function Row({ icon: Icon, label, value }: RowProps) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      {Icon && <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate">{value || "—"}</div>
      </div>
    </div>
  );
}
