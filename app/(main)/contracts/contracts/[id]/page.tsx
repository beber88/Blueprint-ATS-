"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import {
  Loader2,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
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
  draft_source_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RelatedItem {
  id: string;
  issue: string;
  status: string;
  priority: string;
  report_date: string;
  project_raw: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626",
  high: "#EA580C",
  medium: "#C9A84C",
  low: "#6B7280",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#C9A84C",
  in_progress: "#2563EB",
  blocked: "#DC2626",
  resolved: "#16A34A",
};

export default function ContractDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/contracts/${id}`);
      if (!res.ok) {
        toast.error("not found");
        router.push("/hr/contracts/contracts");
        return;
      }
      const json = await res.json();
      setContract(json.contract);
      setProjectName(json.project_name || null);
      setSourceText(json.source_text || null);
      setRelatedItems(json.related_items || []);
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
      {/* ── 2x2 top grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Counterparty */}
        <OpsCard title={t("contracts.detail.counterparty")}>
          <Row label={t("contracts.edit.counterparty") || "Counterparty"} value={contract.counterparty_name} />
          <Row label={t("contracts.edit.contact_name") || "Contact"} value={contract.counterparty_contact_name || "\u2014"} />
          <Row label={t("contracts.edit.contact_email") || "Email"} value={contract.counterparty_contact_email || "\u2014"} />
          <Row label={t("contracts.edit.contact_phone") || "Phone"} value={contract.counterparty_contact_phone || "\u2014"} />
        </OpsCard>

        {/* Dates */}
        <OpsCard title={t("contracts.detail.dates")}>
          <Row label={t("contracts.edit.signing_date") || "Signing"} value={contract.signing_date || "\u2014"} />
          <Row label={t("contracts.edit.effective_date") || "Effective"} value={contract.effective_date || "\u2014"} />
          <Row label={t("contracts.edit.expiration_date") || "Expiration"} value={contract.expiration_date || "\u2014"} />
          <Row label={t("contracts.edit.renewal_date") || "Renewal"} value={contract.renewal_date || "\u2014"} />
          <Row label={t("contracts.edit.is_renewable") || "Renewable"} value={contract.is_renewable ? t("common.yes") || "Yes" : t("common.no") || "No"} />
        </OpsCard>

        {/* Value & Status */}
        <OpsCard title={t("contracts.detail.value")}>
          <Row
            label={t("contracts.edit.monetary_value") || "Value"}
            value={
              contract.monetary_value != null
                ? `${(contract.currency === "USD" ? "$" : "₱")}${Number(contract.monetary_value).toLocaleString()}`
                : "\u2014"
            }
          />
          <Row label={t("contracts.list.col_status") || "Status"} value={t(`contracts.status.${contract.status}`) || contract.status} />
          <Row label={t("contracts.edit.flagged") || "Flagged"} value={contract.flagged_for_review ? t("common.yes") || "Yes" : t("common.no") || "No"} />
        </OpsCard>

        {/* Related Project */}
        <OpsCard title={t("contracts.detail.project")}>
          {contract.project_id && projectName ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderOpen size={16} style={{ color: "#C9A84C" }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  {projectName}
                </span>
              </div>
              <a
                href={`/hr/operations/projects`}
                style={{
                  fontSize: 12,
                  color: "#C9A84C",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {t("contracts.detail.view_project")}
                <ExternalLink size={11} />
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
              {t("contracts.detail.no_project")}
            </div>
          )}
        </OpsCard>
      </div>

      {/* ── Summary — full width ── */}
      <div style={{ marginTop: 16 }}>
        <OpsCard
          title={t("contracts.detail.summary")}
          style={{ borderTop: "3px solid #C9A84C" }}
        >
          <div
            style={{
              fontSize: 14,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              minHeight: 60,
            }}
          >
            {contract.summary || "\u2014"}
          </div>
        </OpsCard>
      </div>

      {/* ── Document section ── */}
      {contract.storage_path && (
        <div style={{ marginTop: 16 }}>
          <OpsCard title={t("contracts.detail.document")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={18} style={{ color: "#C9A84C" }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)", wordBreak: "break-all" }}>
                {contract.storage_path.split("/").pop()}
              </span>
              <a
                href={contract.storage_path}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "#C9A84C",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  border: "1px solid #C9A84C",
                  borderRadius: 6,
                }}
              >
                <ExternalLink size={12} />
                Open
              </a>
            </div>
          </OpsCard>
        </div>
      )}

      {/* ── Related Report Items ── */}
      <div style={{ marginTop: 16 }}>
        <OpsCard title={t("contracts.detail.related_items")}>
          {relatedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
              {t("contracts.detail.no_related_items")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {relatedItems.map((item) => (
                <a
                  key={item.id}
                  href={`/hr/operations/items/${item.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-light)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <AlertCircle
                    size={14}
                    style={{ color: PRIORITY_COLORS[item.priority] || "#6B7280", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.issue}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                      {item.report_date}
                      {item.project_raw ? ` · ${item.project_raw}` : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: `${STATUS_COLORS[item.status] || "#6B7280"}18`,
                      color: STATUS_COLORS[item.status] || "#6B7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}
                  >
                    {item.status}
                  </span>
                </a>
              ))}
            </div>
          )}
        </OpsCard>
      </div>

      {/* ── Source Text (collapsible) ── */}
      {sourceText && (
        <div style={{ marginTop: 16 }}>
          <OpsCard>
            <button
              onClick={() => setSourceExpanded((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: 0,
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {sourceExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {sourceExpanded
                ? t("contracts.detail.hide_source")
                : t("contracts.detail.show_source")}
            </button>
            {sourceExpanded && (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  background: "var(--bg-secondary, #1a1a1a)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  maxHeight: 400,
                  overflowY: "auto",
                  fontFamily: "monospace",
                }}
              >
                {sourceText}
              </div>
            )}
          </OpsCard>
        </div>
      )}

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
