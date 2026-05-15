"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { EmployeeListItem, EMPLOYMENT_STATUS_LABEL_KEY } from "@/types/employees";
import { formatDate } from "@/lib/utils";

interface Props {
  employees: EmployeeListItem[];
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  probation: "bg-amber-50 text-amber-700 ring-amber-200/60",
  on_leave: "bg-blue-50 text-blue-700 ring-blue-200/60",
  terminated: "bg-rose-50 text-rose-700 ring-rose-200/60",
  resigned: "bg-slate-50 text-slate-700 ring-slate-200/60",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function EmployeeList({ employees }: Props) {
  const { t } = useI18n();

  if (!employees.length) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("employees.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">{t("employees.table.employee")}</th>
            <th className="px-4 py-3 text-left">{t("employees.table.position")}</th>
            <th className="px-4 py-3 text-left">{t("employees.table.department")}</th>
            <th className="px-4 py-3 text-left">{t("employees.table.status")}</th>
            <th className="px-4 py-3 text-left">{t("employees.table.hire_date")}</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/employees/${emp.id}`} className="flex items-center gap-3 group">
                  <Avatar className="h-9 w-9">
                    {emp.photo_url && <AvatarImage src={emp.photo_url} alt={emp.full_name} />}
                    <AvatarFallback className="bg-amber-100 text-amber-800 text-xs font-medium">
                      {initials(emp.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium group-hover:text-amber-700">{emp.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {emp.employee_code || emp.email || emp.phone || "—"}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">{emp.position || "—"}</td>
              <td className="px-4 py-3 text-sm">{emp.department?.name || "—"}</td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={`ring-1 ${STATUS_COLOR[emp.employment_status] || "bg-slate-50 text-slate-700"}`}
                >
                  {t(EMPLOYMENT_STATUS_LABEL_KEY[emp.employment_status])}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm">
                {emp.hire_date ? formatDate(emp.hire_date) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
