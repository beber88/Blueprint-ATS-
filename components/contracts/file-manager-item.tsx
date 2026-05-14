"use client";

import { Folder, FileText, MoreVertical, Pencil, Move, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContractFolder, ContractStatus } from "@/lib/contracts/types";

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
      onDoubleClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--border-light)",
        background: "var(--bg-card)",
        cursor: "pointer",
        position: "relative",
        minHeight: 120,
        justifyContent: "center",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9A84C")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
    >
      <div style={{ position: "absolute", top: 6, insetInlineEnd: 6 }}>
        <ItemMenu onRename={onRename} onMove={onMove} onDelete={onDelete} />
      </div>
      <Folder size={40} style={{ color: folder.color || "#C9A84C" }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          textAlign: "center",
          color: "var(--text-primary)",
          wordBreak: "break-word",
          maxWidth: "100%",
        }}
      >
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
    <tr
      onDoubleClick={onOpen}
      style={{ borderTop: "1px solid var(--border-light)", cursor: "pointer" }}
    >
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
  return (
    <div
      onDoubleClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--border-light)",
        background: "var(--bg-card)",
        cursor: "pointer",
        position: "relative",
        minHeight: 120,
        justifyContent: "center",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.5)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
    >
      <div style={{ position: "absolute", top: 6, insetInlineEnd: 6 }}>
        <ContractMenu onMove={onMove} />
      </div>
      <FileText size={36} style={{ color: "var(--text-secondary)" }} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          textAlign: "center",
          color: "var(--text-primary)",
          wordBreak: "break-word",
          maxWidth: "100%",
        }}
      >
        {contract.title}
      </span>
      <StatusBadge status={contract.status as ContractStatus} />
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
  return (
    <tr
      onDoubleClick={onOpen}
      style={{ borderTop: "1px solid var(--border-light)", cursor: "pointer" }}
    >
      <td style={{ padding: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <span style={{ color: "#C9A84C" }}>{contract.title}</span>
        </div>
      </td>
      <td style={{ padding: 8, color: "var(--text-secondary)" }}>{contract.category}</td>
      <td style={{ padding: 8 }}>{contract.counterparty_name}</td>
      <td style={{ padding: 8, color: "var(--text-secondary)" }}>
        {contract.expiration_date || "—"}
      </td>
      <td style={{ padding: 8 }}>
        {contract.monetary_value != null
          ? `${contract.monetary_value} ${contract.currency || ""}`.trim()
          : "—"}
      </td>
      <td style={{ padding: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge status={contract.status as ContractStatus} />
          <ContractMenu onMove={onMove} />
        </div>
      </td>
    </tr>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContractStatus }) {
  const bg =
    status === "active"
      ? "rgba(26,86,168,0.1)"
      : status === "expired"
      ? "rgba(163,45,45,0.1)"
      : "rgba(0,0,0,0.05)";
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, background: bg, fontSize: 11 }}>
      {status}
    </span>
  );
}

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
