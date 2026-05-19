"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Shield, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface EmployeeCompliance {
  employee_id: string;
  employee_name: string;
  ids: Record<string, { number: string | null; has_document: boolean }>;
  missing_ids: string[];
  missing_docs: string[];
  is_compliant: boolean;
  compliance_score: number;
}

interface ComplianceData {
  employees: EmployeeCompliance[];
  summary: { total: number; compliant: number; non_compliant: number; compliance_rate: number };
}

const ID_LABELS: Record<string, { en: string; he: string }> = {
  sss: { en: "SSS", he: "SSS" },
  philhealth: { en: "PhilHealth", he: "PhilHealth" },
  pagibig: { en: "Pag-IBIG", he: "Pag-IBIG" },
  tin: { en: "TIN", he: "TIN" },
};

export default function CompliancePage() {
  const { locale } = useI18n();
  const isHe = locale === "he";
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "compliant" | "non_compliant">("all");

  useEffect(() => {
    fetch("/api/hr/compliance")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <div className="p-6 text-center text-muted-foreground">Error loading compliance data</div>;

  const filtered = data.employees.filter((e) => {
    if (filter === "compliant") return e.is_compliant;
    if (filter === "non_compliant") return !e.is_compliant;
    return true;
  });

  const rateColor = data.summary.compliance_rate >= 80 ? "#10B981" : data.summary.compliance_rate >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <div className="p-6 space-y-6" dir={isHe ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">{isHe ? "התאמה ממשלתית" : "Government Compliance"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isHe ? "מעקב אחר SSS, PhilHealth, Pag-IBIG ו-TIN לכל עובד" : "Track SSS, PhilHealth, Pag-IBIG, and TIN for every employee"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Shield className="h-4 w-4" />
            {isHe ? "שיעור התאמה" : "Compliance Rate"}
          </div>
          <p className="text-3xl font-bold" style={{ color: rateColor }}>{data.summary.compliance_rate}%</p>
        </div>
        <div className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30" onClick={() => setFilter("compliant")}>
          <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
            <CheckCircle className="h-4 w-4" />
            {isHe ? "תקינים" : "Compliant"}
          </div>
          <p className="text-3xl font-bold text-green-600">{data.summary.compliant}</p>
        </div>
        <div className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30" onClick={() => setFilter("non_compliant")}>
          <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
            <XCircle className="h-4 w-4" />
            {isHe ? "חסרים" : "Non-Compliant"}
          </div>
          <p className="text-3xl font-bold text-red-500">{data.summary.non_compliant}</p>
        </div>
        <div className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30" onClick={() => setFilter("all")}>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <AlertTriangle className="h-4 w-4" />
            {isHe ? 'סה"כ עובדים' : "Total Employees"}
          </div>
          <p className="text-3xl font-bold">{data.summary.total}</p>
        </div>
      </div>

      {/* Employee Compliance Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start py-2 px-3">{isHe ? "עובד" : "Employee"}</th>
              <th className="text-center py-2 px-3">SSS</th>
              <th className="text-center py-2 px-3">PhilHealth</th>
              <th className="text-center py-2 px-3">Pag-IBIG</th>
              <th className="text-center py-2 px-3">TIN</th>
              <th className="text-center py-2 px-3">{isHe ? "ציון" : "Score"}</th>
              <th className="text-center py-2 px-3">{isHe ? "סטטוס" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.employee_id} className="border-t hover:bg-muted/30">
                <td className="py-2 px-3">
                  <Link href={`/hr/hr-management/employees/${emp.employee_id}`} className="font-medium text-foreground hover:underline">
                    {emp.employee_name}
                  </Link>
                </td>
                {["sss", "philhealth", "pagibig", "tin"].map((idType) => {
                  const info = emp.ids[idType];
                  return (
                    <td key={idType} className="py-2 px-3 text-center">
                      {info?.number ? (
                        <span className="text-green-600 text-xs font-mono">{info.number}</span>
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      )}
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-center">
                  <span className={`font-bold ${emp.compliance_score === 100 ? "text-green-600" : emp.compliance_score >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                    {emp.compliance_score}%
                  </span>
                </td>
                <td className="py-2 px-3 text-center">
                  {emp.is_compliant ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" /> {isHe ? "תקין" : "OK"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" /> {emp.missing_ids.length} {isHe ? "חסרים" : "missing"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
