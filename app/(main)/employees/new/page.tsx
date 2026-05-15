"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { useI18n } from "@/lib/i18n/context";
import { ArrowLeft } from "lucide-react";

export default function NewEmployeePage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t("common.back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{t("employees.new.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("employees.new.subtitle")}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <EmployeeForm
          onSaved={(employee) => router.push(`/employees/${employee.id}`)}
          onCancel={() => router.push("/employees")}
        />
      </div>
    </div>
  );
}
