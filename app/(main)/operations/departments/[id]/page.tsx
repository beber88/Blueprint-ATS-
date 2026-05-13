"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";
import { ItemsTable } from "@/components/operations/items-table";

export default function DepartmentDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ department: { name: string; name_he: string | null } | null; items: unknown[] }>({ department: null, items: [] });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/operations/departments/${id}`)
      .then((r) => r.json())
      .then((d) => setData({ department: d.department, items: d.items || [] }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (id) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  return (
    <OpsPageShell title={data.department?.name_he || data.department?.name || t("operations.nav.departments")}>
      <OpsCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
        ) : (
          <ItemsTable items={data.items as never} onChange={load} />
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
