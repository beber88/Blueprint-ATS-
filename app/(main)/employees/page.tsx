"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeList } from "@/components/employees/EmployeeList";
import { useI18n } from "@/lib/i18n/context";
import { EmployeeListItem, EmploymentStatus, Department } from "@/types/employees";
import { Plus, Search, Loader2 } from "lucide-react";

const STATUSES: EmploymentStatus[] = ["active", "probation", "on_leave", "terminated", "resigned"];

export default function EmployeesPage() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (departmentId) params.set("departmentId", departmentId);
    params.set("limit", "100");

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/employees?${params.toString()}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          setEmployees(data.employees || []);
          setTotal(data.total || 0);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [search, status, departmentId]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("employees.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("employees.total")}: {total}
          </p>
        </div>
        <Link href="/employees/new">
          <Button>
            <Plus className="me-2 h-4 w-4" />
            {t("employees.add")}
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("employees.search_placeholder")}
            className="ps-9"
          />
        </div>
        <Select value={status || "__all__"} onValueChange={(v) => setStatus(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("employees.filter.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("employees.filter.all_status")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`employees.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={departmentId || "__all__"}
          onValueChange={(v) => setDepartmentId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("employees.filter.department")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("employees.filter.all_departments")}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <EmployeeList employees={employees} />
      )}
    </div>
  );
}
