"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Employee {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  position?: string | null;
  hire_date?: string | null;
  employment_type?: string | null;
  manager_id?: string | null;
  status?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
  probation: "Probation",
};

export default function EmployeesPage() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetch("/api/operations/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = employees.filter((e) => {
    const matchSearch =
      !search ||
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.employment_type === typeFilter;
    return matchSearch && matchType;
  });

  const activeCount = employees.filter((e) => e.status !== "terminated").length;
  const types = Array.from(new Set(employees.map((e) => e.employment_type).filter(Boolean)));

  return (
    <OpsPageShell
      title={t("hr_mgmt.employees.title")}
      subtitle={t("hr_mgmt.employees.subtitle")}
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Employees" value={employees.length} accent="#C9A84C" />
        <KpiCard label="Active" value={activeCount} accent="#10B981" />
        <KpiCard label="Departments" value={new Set(employees.map((e) => e.department_id).filter(Boolean)).size} accent="#3B82F6" />
      </div>

      {/* Filters */}
      <OpsCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-secondary)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              style={{
                width: "100%", padding: "8px 12px 8px 30px", borderRadius: 6,
                border: "1px solid var(--border-light)", background: "var(--bg-card)",
                color: "var(--text-primary)", fontSize: 13,
              }}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)",
              background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13,
            }}
          >
            <option value="all">All Types</option>
            {types.map((tp) => (
              <option key={tp} value={tp!}>{TYPE_LABELS[tp!] || tp}</option>
            ))}
          </select>
        </div>
      </OpsCard>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : filtered.length === 0 ? (
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            No employees found
          </p>
        </OpsCard>
      ) : (
        <OpsCard>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Position</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Department</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Hire Date</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Contact</th>
                <th style={{ padding: "8px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {emp.full_name}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                    {emp.position || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                    {emp.department_name || "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {emp.employment_type ? (
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: "rgba(201,168,76,0.12)", color: "#C9A84C",
                      }}>
                        {TYPE_LABELS[emp.employment_type] || emp.employment_type}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                    {emp.hire_date ? format(new Date(emp.hire_date), "MMM d, yyyy") : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
                    {emp.email || emp.phone || "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Link
                      href={`/hr-management/employees/${emp.id}`}
                      style={{ color: "#C9A84C", display: "flex", alignItems: "center", gap: 2, textDecoration: "none", fontSize: 12 }}
                    >
                      View <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpsCard>
      )}
    </OpsPageShell>
  );
}
