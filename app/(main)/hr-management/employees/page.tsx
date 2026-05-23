"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Users, CheckCircle, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Department { id: string; name: string; name_he: string | null; color: string | null }

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department_id: string | null;
  department: Department | null;
  hire_date: string | null;
  employment_type: string | null;
  is_active: boolean;
  doc_count: number;
  current_salary: number | null;
  has_salary: boolean;
  missing_gov_ids: string[];
  compliance_score: number;
  data_completeness: number;
}

interface Summary {
  total: number;
  active: number;
  with_salary: number;
  with_docs: number;
  fully_compliant: number;
  avg_completeness: number;
}

function fmt(n: number) {
  return "₱" + n.toLocaleString("en-PH");
}

export default function EmployeesPage() {
  const { locale } = useI18n();
  const isHe = locale === "he";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter === "all") params.set("include_inactive", "true");
    if (search) params.set("search", search);
    if (deptFilter !== "all") params.set("department_id", deptFilter);

    const res = await fetch(`/api/hr/employees?${params}`);
    const data = await res.json();
    setEmployees(data.employees || []);
    setDepartments(data.departments || []);
    setSummary(data.summary || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [deptFilter, statusFilter]);

  const filtered = employees.filter((e) => {
    if (statusFilter === "active" && !e.is_active) return false;
    if (statusFilter === "inactive" && e.is_active) return false;
    if (search) {
      const s = search.toLowerCase();
      return e.full_name.toLowerCase().includes(s) || (e.role || "").toLowerCase().includes(s) || (e.email || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6" dir={isHe ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">{isHe ? "ניהול עובדים" : "Employee Management"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isHe ? "תיק עובד מלא — פרטים, מסמכים, שכר, תנאי העסקה" : "Complete employee file — details, documents, salary, employment terms"}
        </p>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" />
              {isHe ? "פעילים" : "Active"}
            </div>
            <p className="text-xl font-bold">{summary.active}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs mb-1" style={{ color: summary.fully_compliant === summary.active ? "#10B981" : "#F59E0B" }}>
              <CheckCircle className="h-3.5 w-3.5" />
              {isHe ? "תקינים (Gov)" : "Compliant"}
            </div>
            <p className="text-xl font-bold">{summary.fully_compliant}/{summary.active}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3.5 w-3.5" />
              {isHe ? "עם מסמכים" : "With Docs"}
            </div>
            <p className="text-xl font-bold">{summary.with_docs}/{summary.active}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              {isHe ? "עם שכר" : "With Salary"}
            </div>
            <p className="text-xl font-bold">{summary.with_salary}/{summary.active}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              {isHe ? "שלמות ממוצעת" : "Avg Completeness"}
            </div>
            <p className="text-xl font-bold" style={{ color: summary.avg_completeness >= 70 ? "#10B981" : summary.avg_completeness >= 40 ? "#F59E0B" : "#EF4444" }}>
              {summary.avg_completeness}%
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isHe ? "חיפוש עובד..." : "Search employee..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="ps-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isHe ? "כל המחלקות" : "All Departments"}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{isHe ? (d.name_he || d.name) : d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{isHe ? "פעילים" : "Active"}</SelectItem>
            <SelectItem value="inactive">{isHe ? "לא פעילים" : "Inactive"}</SelectItem>
            <SelectItem value="all">{isHe ? "הכל" : "All"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employees Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start py-2.5 px-3 font-medium">{isHe ? "עובד" : "Employee"}</th>
                <th className="text-start py-2.5 px-3 font-medium">{isHe ? "תפקיד" : "Role"}</th>
                <th className="text-start py-2.5 px-3 font-medium">{isHe ? "מחלקה" : "Department"}</th>
                <th className="text-start py-2.5 px-3 font-medium">{isHe ? "תאריך גיוס" : "Hire Date"}</th>
                <th className="text-end py-2.5 px-3 font-medium">{isHe ? "שכר" : "Salary"}</th>
                <th className="text-center py-2.5 px-3 font-medium">{isHe ? "מסמכים" : "Docs"}</th>
                <th className="text-center py-2.5 px-3 font-medium">{isHe ? "שלמות" : "Complete"}</th>
                <th className="text-center py-2.5 px-3 font-medium">Gov</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="py-2.5 px-3">
                    <Link href={`/hr/hr-management/employees/${e.id}`} className="font-medium text-foreground hover:underline">
                      {e.full_name}
                    </Link>
                    {e.email && <p className="text-xs text-muted-foreground">{e.email}</p>}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{e.role || "—"}</td>
                  <td className="py-2.5 px-3">
                    {e.department ? (
                      <span className="inline-flex items-center gap-1.5">
                        {e.department.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.department.color }} />}
                        <span className="text-sm">{isHe ? (e.department.name_he || e.department.name) : e.department.name}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {e.hire_date ? new Date(e.hire_date).toLocaleDateString(isHe ? "he-IL" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono">
                    {e.current_salary ? fmt(e.current_salary) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {e.doc_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {e.doc_count}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">0</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-xs font-bold ${e.data_completeness >= 70 ? "text-green-600" : e.data_completeness >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                      {e.data_completeness}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {e.missing_gov_ids.length === 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto" />
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <Link href={`/hr/hr-management/employees/${e.id}`}>
                      <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
