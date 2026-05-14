"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { ItemsTable } from "@/components/operations/items-table";
import { toast } from "sonner";

export default function DepartmentDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ department: { name: string; name_he: string | null } | null; items: unknown[] }>({ department: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/operations/departments/${id}`)
      .then((r) => r.json())
      .then((d) => setData({ department: d.department, items: d.items || [] }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (id) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/operations/departments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("common.success"));
      router.push("/hr/operations/departments");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <OpsPageShell
      title={data.department?.name_he || data.department?.name || t("operations.nav.departments")}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => router.push("/hr/operations/departments")}>
            <Pencil size={14} />
            {t("common.edit")}
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} />
            {t("common.delete")}
          </Button>
        </div>
      }
    >
      <OpsCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
        ) : (
          <ItemsTable items={data.items as never} onChange={load} />
        )}
      </OpsCard>

      <ConfirmDeleteDialog
        open={deleteOpen}
        loading={deleteBusy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </OpsPageShell>
  );
}
