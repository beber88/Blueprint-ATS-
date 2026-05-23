"use client";

import { useI18n } from "@/lib/i18n/context";
import { Folder, FileText, MoreVertical, Pencil, Move, Trash2, Calendar, Building2, DollarSign } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContractFolder } from "@/lib/contracts/types";

// ── Folder card (grid) ─────────────────────────────────────────────────────

interface FolderGridProps {
  folder: ContractFolder;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function FolderGridItem({ folder, onOpen, onRename, onMove, onDelete }: FolderGridProps) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 16,
        borderRadius: 10,
        border: "1px solid var(--border-light)",
        background: "var(--bg-card)",
        cursor: "pointer",
        position: "relative",
        minHeight: 120,
        justifyContent: "center",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#C9A84C";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(201,168,76,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", top: 6, insetInlineEnd: 6 }}>
        <ItemMenu onRename={onRename} onMove={onMove} onDelete={onDelete} />
      </div>
      <Folder size={40} style={{ color: folder.color || "#C9A84C" }} />
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center", color: "var(--text-primary)", wordBreak: "break-word", maxWidth: "100%" }}>
        {folder.name}
      </span>
    </div>
  );
}

// ── Folder row (list) ──────────────────────────────────────────────────────

interface FolderListProps {
  folder: ContractFolder;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function FolderListItem({ folder, onOpen, onRename, onMove, onDelete }: FolderListProps) {
  return (
    <tr onClick={onOpen} style={{ borderTop: "1px solid var(--border-light)", cursor: "pointer" }}>
      <td style={{ padding: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Folder size={18} style={{ color: folder.color || "#C9A84C", flexShrink: 0 }} />
          <span style={{ fontWeight: 500 }}>{folder.name}</span>
        </div>
      </td>
      <td style={{ padding: 8, color: "var(--text-secondary)" }}>Folder</td>
      <td style={{ padding: 8 }}>—</td>
      <td style={{ padding: 8 }}>—</td>
      <td style={{ padding: 8 }}>—</td>
      <td style={{ padding: 8 }}>
        <ItemMenu onRename={onRename} onMove={onMove} onDelete={onDelete} />
      </td>
    </tr>
  );
}

// ── Colors & helpers ───────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  subcontractor: { bg: "rgba(61,138,125,0.1)", text: "#3D8A7D", label: "Subcontractor" },
  vendor: { bg: "rgba(26,86,168,0.1)", text: "#1A56A8", label: "Vendor" },
  customer: { bg: "rgba(201,168,76,0.1)", text: "#A88B3D", label: "Customer" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(45,122,62,0.1)", text: "#2D7A3E" },
  expired: { bg: "rgba(163,45,45,0.1)", text: "#A32D2D" },
  terminated: { bg: "rgba(163,45,45,0.08)", text: "#7A1F1F" },
  draft: { bg: "rgba(0,0,0,0.05)", text: "var(--text-secondary)" },
  renewed: { bg: "rgba(26,86,168,0.1)", text: "#1A56A8" },
};

function formatPHP(value: number | null, currency: string | null): string {
  if (value == null) return "";
  const sym = currency === "USD" ? "$" : "₱";
  return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Contract card (grid) ────────────────────────────────────────────────────

interface ContractGridProps {
  contract: {
    id: string;
    title: string;
    category: string;
    counterparty_name: string;
    status: string;
    expiration_date: string | null;
    monetary_value: number | null;
    currency: string | null;
  };
  onOpen: () => void;
  onMove: () => void;
}

export function ContractGridItem({ contract, onOpen, onMove }: ContractGridProps) {
  const { t } = useI18n();
  const cat = CATEGORY_STYLE[contract.category] || CATEGORY_STYLE.vendor;
  const stat = STATUS_STYLE[contract.status] || STATUS_STYLE.draft;
  const catLabel = t(`contracts.category.${contract.category}`) || contract.category;
  const statLabel = t(`contracts.status.${contract.status}`) || contract.status;

  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 0,
        borderRadius: 10,
        border: "1px solid var(--border-light)",
        background: "var(--bg-card)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#C9A84C";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Color accent top bar */}
      <div style={{ height: 3, background: cat.text }} />

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {/* Header: category + menu */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "3px 8px",
            borderRadius: 4,
            background: cat.bg,
            color: cat.text,
          }}>
            {catLabel}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <ContractMenu onMove={onMove} />
          </div>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-primary)",
          lineHeight: 1.35,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
          minHeight: 38,
        }}>
          {contract.title}
        </div>

        {/* Counterparty */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Building2 size={12} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contract.counterparty_name || "—"}
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom section */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: "1px solid var(--border-light)",
          paddingTop: 10,
          marginTop: 2,
        }}>
          {/* Value */}
          <div>
            {contract.monetary_value != null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <DollarSign size={13} style={{ color: "#C9A84C" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#C9A84C" }}>
                  {formatPHP(contract.monetary_value, contract.currency)}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>No value</span>
            )}
            {contract.expiration_date && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <Calendar size={10} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {contract.expiration_date}
                </span>
              </div>
            )}
          </div>

          {/* Status */}
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 12,
            background: stat.bg,
            color: stat.text,
            textTransform: "capitalize",
          }}>
            {statLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Contract row (list) ─────────────────────────────────────────────────────

interface ContractListItemProps {
  contract: {
    id: string;
    title: string;
    category: string;
    counterparty_name: string;
    status: string;
    expiration_date: string | null;
    monetary_value: number | null;
    currency: string | null;
  };
  onOpen: () => void;
  onMove: () => void;
}

export function ContractListRow({ contract, onOpen, onMove }: ContractListItemProps) {
  const { t } = useI18n();
  const cat = CATEGORY_STYLE[contract.category] || CATEGORY_STYLE.vendor;
  const stat = STATUS_STYLE[contract.status] || STATUS_STYLE.draft;
  const catLabel = t(`contracts.category.${contract.category}`) || contract.category;
  const statLabel = t(`contracts.status.${contract.status}`) || contract.status;

  return (
    <tr
      onClick={onOpen}
      style={{ borderTop: "1px solid var(--border-light)", cursor: "pointer" }}
    >
      <td style={{ padding: "10px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} style={{ color: cat.text, flexShrink: 0 }} />
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{contract.title}</span>
        </div>
      </td>
      <td style={{ padding: "10px 8px" }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          padding: "2px 6px",
          borderRadius: 4,
          background: cat.bg,
          color: cat.text,
        }}>
          {catLabel}
        </span>
      </td>
      <td style={{ padding: "10px 8px", color: "var(--text-secondary)", fontSize: 13 }}>
        {contract.counterparty_name}
      </td>
      <td style={{ padding: "10px 8px", color: "var(--text-secondary)", fontSize: 13 }}>
        {contract.expiration_date || "—"}
      </td>
      <td style={{ padding: "10px 8px", fontWeight: 600, color: "#C9A84C", fontSize: 13 }}>
        {formatPHP(contract.monetary_value, contract.currency) || "—"}
      </td>
      <td style={{ padding: "10px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 12,
            background: stat.bg,
            color: stat.text,
            textTransform: "capitalize",
          }}>
            {statLabel}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <ContractMenu onMove={onMove} />
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function ItemMenu({
  onRename,
  onMove,
  onDelete,
}: {
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 4,
            color: "var(--text-secondary)",
          }}
        >
          <MoreVertical size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRename}>
          <Pencil size={14} style={{ marginInlineEnd: 8 }} /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMove}>
          <Move size={14} style={{ marginInlineEnd: 8 }} /> Move to...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} style={{ color: "#A32D2D" }}>
          <Trash2 size={14} style={{ marginInlineEnd: 8 }} /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContractMenu({ onMove }: { onMove: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 4,
            color: "var(--text-secondary)",
          }}
        >
          <MoreVertical size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onMove}>
          <Move size={14} style={{ marginInlineEnd: 8 }} /> Move to...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
