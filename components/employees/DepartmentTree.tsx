"use client";

import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { Department } from "@/types/employees";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  departments: (Department & { employee_count?: number })[];
}

interface TreeNode extends Department {
  employee_count?: number;
  children: TreeNode[];
}

function buildTree(departments: (Department & { employee_count?: number })[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  departments.forEach((d) => map.set(d.id, { ...d, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_department_id && map.has(node.parent_department_id)) {
      map.get(node.parent_department_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function NodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <>
      <div
        className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/30"
        style={{ marginInlineStart: depth * 24 }}
      >
        <Link href={`/departments/${node.id}`} className="flex items-center gap-2.5 group">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium group-hover:text-amber-700">{node.name}</div>
            {node.description && (
              <div className="text-xs text-muted-foreground">{node.description}</div>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {node.employee_count ?? 0}
        </div>
      </div>
      {node.children.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function DepartmentTree({ departments }: Props) {
  const { t } = useI18n();
  const tree = buildTree(departments);

  if (!tree.length) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("departments.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tree.map((node) => (
        <NodeRow key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
