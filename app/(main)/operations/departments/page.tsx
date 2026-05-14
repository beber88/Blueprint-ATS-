"use client";

import { useEffect, useState } from "react";
import { OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface Dept { id: string; code: string; name: string; name_he: string | null; color: string | null }

export default function DepartmentsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/operations/departments")
      .then((r) => r.json())
      .then((d) => setItems(d.departments || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <OpsPageShell title={t("operations.nav.departments")} subtitle={t("operations.departments.subtitle")}>
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {items.map((d) => (
            <Link
              key={d.id}
              href={`/hr/operations/departments/${d.id}`}
              style={{
                display: "block",
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderTop: `3px solid ${d.color || "#C9A84C"}`,
                borderRadius: 10,
                padding: 16,
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>{d.code}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{d.name_he || d.name}</div>
            </Link>
          ))}
        </div>
      )}
    </OpsPageShell>
  );
}
