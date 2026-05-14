"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";
import { ItemsTable } from "@/components/operations/items-table";

export default function ProjectDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ project: { name: string; code: string | null; status: string } | null; items: unknown[] }>({ project: null, items: [] });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/operations/projects/${id}`)
      .then((r) => r.json())
      .then((d) => setData({ project: d.project, items: d.items || [] }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (id) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  return (
    <OpsPageShell title={data.project?.name || t("operations.nav.projects")} subtitle={data.project?.code || undefined}>
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
