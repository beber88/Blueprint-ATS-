"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditContractDialog } from "@/components/contracts/edit-contract-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

interface ContractFull {
  id: string;
  category: string;
  counterparty_name: string;
  counterparty_contact_name: string | null;
  counterparty_contact_email: string | null;
  counterparty_contact_phone: string | null;
  project_id: string | null;
  title: string;
  summary: string | null;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  is_renewable: boolean;
  status: string;
  storage_path: string | null;
  flagged_for_review: boolean;
  created_at: string;
  updated_at: string;
}

export default function ContractDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/contracts/${id}`);
      if (!res.ok) {
        toast.error("not found");
        router.push("/hr/contracts/contracts");
        return;
      }
      setContract((await res.json()).contract);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contracts/contracts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("common.delete"));
        router.push("/hr/contracts/contracts");
      } else {
        toast.error(t("common.error"));
      }
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <OpsPageShell title={t("contracts.detail.title")}>
        <div style={{ padding: 60, textAlign: "center" }}>
          <Loader2 className="animate-spin" />
        </div>
      </OpsPageShell>
    );
  }
  if (!contract) return null;

  return (
    <OpsPageShell
      title={contract.title}
      subtitle={`${t(`contracts.category.${contract.category}`) || contract.category} · ${contract.counterparty_name}`}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setEditOpen(true)}
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-primary)",
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            style={{
              background: "transparent",
              color: "#A32D2D",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #A32D2D",
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <OpsCard title={t("contracts.detail.counterparty")}>
          <Row label="name" value={contract.counterparty_name} />
          <Row label="contact" value={contract.counterparty_contact_name || "—"} />
          <Row label="email" value={contract.counterparty_contact_email || "—"} />
          <Row label="phone" value={contract.counterparty_contact_phone || "—"} />
        </OpsCard>

        <OpsCard title={t("contracts.detail.dates")}>
          <Row label="signing" value={contract.signing_date || "—"} />
          <Row label="effective" value={contract.effective_date || "—"} />
          <Row label="expiration" value={contract.expiration_date || "—"} />
          <Row label="renewal" value={contract.renewal_date || "—"} />
          <Row
            label="renewable"
            value={contract.is_renewable ? "yes" : "no"}
          />
        </OpsCard>

        <OpsCard title={t("contracts.detail.value")}>
          <Row
            label="amount"
            value={
              contract.monetary_value != null
                ? `${contract.monetary_value} ${contract.currency || ""}`.trim()
                : "—"
            }
          />
          <Row label="status" value={t(`contracts.status.${contract.status}`) || contract.status} />
          <Row
            label="flagged"
            value={contract.flagged_for_review ? "yes" : "no"}
          />
        </OpsCard>

        <OpsCard title={t("contracts.detail.summary")}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {contract.summary || "—"}
          </div>
        </OpsCard>
      </div>
      {contract && (
        <EditContractDialog
          open={editOpen}
          contract={contract}
          onClose={() => setEditOpen(false)}
          onUpdated={load}
        />
      )}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={t("common.confirm_delete_title")}
        message={t("common.confirm_delete_message")}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={remove}
        loading={deleting}
      />
    </OpsPageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  );
}
