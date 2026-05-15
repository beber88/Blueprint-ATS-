"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmployeeProfileTabs } from "@/components/employees/EmployeeProfileTabs";
import { useI18n } from "@/lib/i18n/context";
import { Employee, EMPLOYMENT_STATUS_LABEL_KEY } from "@/types/employees";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const id = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) {
        setEmployee(null);
        return;
      }
      const data = await res.json();
      setEmployee(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const handleDelete = async () => {
    if (!confirm(t("employees.confirm_delete"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("employees.toast.delete_failed"));
        return;
      }
      toast.success(t("employees.toast.deleted"));
      router.push("/employees");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4 p-6">
        <Link href="/employees">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t("common.back")}
          </Button>
        </Link>
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("employees.not_found")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/employees">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t("common.back")}
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="me-1.5 h-4 w-4 text-rose-600" />
          {t("common.delete")}
        </Button>
      </div>

      <div className="flex items-start gap-4 rounded-lg border bg-card p-6">
        <Avatar className="h-20 w-20">
          {employee.photo_url && <AvatarImage src={employee.photo_url} alt={employee.full_name} />}
          <AvatarFallback className="bg-amber-100 text-amber-800 text-xl font-medium">
            {initials(employee.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{employee.full_name}</h1>
            <Badge
              variant="outline"
              className={`ring-1 ${STATUS_COLOR[employee.employment_status] || ""}`}
            >
              {t(EMPLOYMENT_STATUS_LABEL_KEY[employee.employment_status])}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {[employee.position || employee.role, employee.department?.name, employee.employee_code]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>

      <EmployeeProfileTabs employee={employee} onChanged={fetchEmployee} />
    </div>
  );
}
