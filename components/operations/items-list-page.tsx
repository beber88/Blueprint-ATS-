"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { ItemsTable } from "./items-table";
import { OpsPageShell, OpsCard } from "./page-shell";
import { Loader2, RefreshCw } from "lucide-react";

interface Filter {
  status?: string;
  priority?: string;
  category?: string;
  ceo_decision_needed?: boolean;
  has_missing_info?: boolean;
  overdue?: boolean;
  open_only?: boolean;
  project_id?: string;
  department_id?: string;
  search?: string;
}

export function ItemsListPage({ title, subtitle, defaultFilter, allowSearch = true }: {
  title: string;
  subtitle?: string;
  defaultFilter?: Filter;
  allowSearch?: boolean;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<unknown[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; name_he: string | null }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (defaultFilter) {
        for (const [k, v] of Object.entries(defaultFilter)) {
          if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
        }
      }
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/operations/items?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCount(data.count || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [defaultFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      fetch("/api/operations/employees").then((r) => r.json()),
      fetch("/api/operations/departments").then((r) => r.json()),
      fetch("/api/operations/projects").then((r) => r.json()),
    ]).then(([er, dr, pr]) => {
      setEmployees(er.employees || []);
      setDepartments(dr.departments || []);
      setProjects(pr.projects || []);
    });
  }, []);

  return (
    <OpsPageShell
      title={title}
      subtitle={subtitle}
      actions={
        <button
          onClick={load}
          style={{ padding: "8px 14px", background: "transparent", border: "1px solid var(--border-primary)", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-primary)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t("operations.actions.refresh")}
        </button>
      }
    >
      {allowSearch && (
        <OpsCard style={{ marginBottom: 16 }}>
          <input
            placeholder={t("operations.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-primary)", borderRadius: 8, fontSize: 14, background: "var(--bg-input)", color: "var(--text-primary)" }}
          />
        </OpsCard>
      )}
      <OpsCard>
        <div style={{ marginBottom: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          {t("operations.results")}: {count}
        </div>
        {loading && items.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <ItemsTable items={items as never} onChange={load} employees={employees} departments={departments} projects={projects} />
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
