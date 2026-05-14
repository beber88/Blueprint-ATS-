"use client";

import { useEffect, useState, useMemo } from "react";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, User } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  position?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  manager_id?: string | null;
  email?: string | null;
  status?: string | null;
}

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

function buildTree(employees: Employee[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  employees.forEach((emp) => {
    map.set(emp.id, { employee: emp, children: [] });
  });

  // Link parent-child
  employees.forEach((emp) => {
    const node = map.get(emp.id)!;
    if (emp.manager_id && map.has(emp.manager_id)) {
      map.get(emp.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function OrgNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Card */}
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: 10,
          padding: "12px 16px",
          minWidth: 160,
          textAlign: "center",
          cursor: hasChildren ? "pointer" : "default",
          borderTop: depth === 0 ? "3px solid #C9A84C" : "1px solid var(--border-light)",
          transition: "box-shadow 0.2s",
          position: "relative",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(201,168,76,0.12)", display: "flex",
          alignItems: "center", justifyContent: "center", margin: "0 auto 6px",
        }}>
          <User size={18} color="#C9A84C" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          {node.employee.full_name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          {node.employee.position || "—"}
        </div>
        {node.employee.department_name && (
          <div style={{
            fontSize: 10, color: "#C9A84C", marginTop: 4,
            padding: "1px 6px", borderRadius: 4,
            background: "rgba(201,168,76,0.1)", display: "inline-block",
          }}>
            {node.employee.department_name}
          </div>
        )}
        {hasChildren && (
          <div style={{
            position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
            width: 16, height: 16, borderRadius: "50%",
            background: "var(--bg-card)", border: "1px solid var(--border-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: "var(--text-secondary)", fontWeight: 600,
          }}>
            {expanded ? "−" : node.children.length}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <>
          {/* Connector line */}
          <div style={{ width: 1, height: 24, background: "var(--border-light)" }} />
          <div style={{
            display: "flex", gap: 16, justifyContent: "center",
            position: "relative", paddingTop: 0,
          }}>
            {/* Horizontal connector */}
            {node.children.length > 1 && (
              <div style={{
                position: "absolute", top: 0,
                left: "calc(50% - " + ((node.children.length - 1) * 88) + "px)",
                right: "calc(50% - " + ((node.children.length - 1) * 88) + "px)",
                height: 1, background: "var(--border-light)",
              }} />
            )}
            {node.children.map((child) => (
              <div key={child.employee.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 1, height: 16, background: "var(--border-light)" }} />
                <OrgNode node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/operations/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []))
      .finally(() => setLoading(false));
  }, []);

  const tree = useMemo(() => buildTree(employees.filter((e) => e.status !== "terminated")), [employees]);

  // Group by department for secondary view
  const departments = useMemo(() => {
    const map = new Map<string, Employee[]>();
    employees.forEach((emp) => {
      if (emp.status === "terminated") return;
      const dept = emp.department_name || "Unassigned";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(emp);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [employees]);

  return (
    <OpsPageShell
      title={t("hr_mgmt.org_chart.title")}
      subtitle={t("hr_mgmt.org_chart.subtitle")}
    >
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : employees.length === 0 ? (
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            No employees found
          </p>
        </OpsCard>
      ) : (
        <>
          {/* Tree view */}
          <OpsCard style={{ marginBottom: 24, overflowX: "auto" }}>
            <div style={{ padding: "20px 0", display: "flex", justifyContent: "center", minWidth: "fit-content" }}>
              <div style={{ display: "flex", gap: 32, justifyContent: "center" }}>
                {tree.map((root) => (
                  <OrgNode key={root.employee.id} node={root} />
                ))}
              </div>
            </div>
          </OpsCard>

          {/* Department groupings */}
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            Department Overview
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {departments.map(([dept, members]) => (
              <OpsCard key={dept}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{dept}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                    background: "rgba(201,168,76,0.12)", color: "#C9A84C",
                  }}>
                    {members.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {members.slice(0, 8).map((emp) => (
                    <div key={emp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "rgba(201,168,76,0.1)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <User size={12} color="#C9A84C" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{emp.full_name}</div>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{emp.position || "—"}</div>
                      </div>
                    </div>
                  ))}
                  {members.length > 8 && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", paddingLeft: 32 }}>
                      +{members.length - 8} more
                    </div>
                  )}
                </div>
              </OpsCard>
            ))}
          </div>
        </>
      )}
    </OpsPageShell>
  );
}
