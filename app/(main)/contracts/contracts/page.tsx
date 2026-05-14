"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { FolderBreadcrumbs } from "@/components/contracts/folder-breadcrumbs";
import { ViewToggle } from "@/components/contracts/view-toggle";
import { CreateFolderDialog } from "@/components/contracts/create-folder-dialog";
import { RenameFolderDialog } from "@/components/contracts/rename-folder-dialog";
import { MoveDialog } from "@/components/contracts/move-dialog";
import {
  FolderGridItem,
  FolderListItem,
  ContractGridItem,
  ContractListRow,
} from "@/components/contracts/file-manager-item";
import { Loader2, FolderPlus } from "lucide-react";
import type { ContractFolder, FolderBreadcrumb as Crumb } from "@/lib/contracts/types";

interface ContractItem {
  id: string;
  category: string;
  counterparty_name: string;
  project_id: string | null;
  title: string;
  expiration_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  status: string;
  flagged_for_review: boolean;
  created_at: string;
}

const CATEGORY_FILTERS = ["", "customer", "subcontractor", "vendor"];
const STATUS_FILTERS = ["", "active", "expired", "terminated", "renewed", "draft"];

function getStoredView(): "grid" | "list" {
  if (typeof window === "undefined") return "grid";
  return (localStorage.getItem("contracts_view") as "grid" | "list") || "grid";
}

export default function ContractsFileManagerPage() {
  return (
    <Suspense fallback={null}>
      <ContractsFileManager />
    </Suspense>
  );
}

function ContractsFileManager() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFolderId = searchParams.get("folder") || null;

  const [viewMode, setViewMode] = useState<"grid" | "list">(getStoredView);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [folders, setFolders] = useState<ContractFolder[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ContractFolder | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    type: "folder" | "contract";
    id: string;
    excludeFolderId?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFolderId) params.set("parent_id", currentFolderId);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      const res = await fetch(`/api/contracts/folders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setContracts(data.contracts || []);
        setBreadcrumbs(data.breadcrumbs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, category, status]);

  useEffect(() => {
    load();
  }, [load]);

  function handleViewChange(mode: "grid" | "list") {
    setViewMode(mode);
    localStorage.setItem("contracts_view", mode);
  }

  function navigateToFolder(folderId: string | null) {
    if (folderId) {
      router.push(`?folder=${folderId}`);
    } else {
      router.push("?");
    }
  }

  function openContract(id: string) {
    router.push(`/contracts/contracts/${id}`);
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm(t("contracts.folders.confirm_delete") || "Delete this folder and all subfolders? Contracts inside will be moved to root.")) return;
    await fetch(`/api/contracts/folders/${id}`, { method: "DELETE" });
    load();
  }

  async function handleMoveConfirm(destinationFolderId: string | null) {
    if (!moveTarget) return;
    try {
      if (moveTarget.type === "contract") {
        await fetch(`/api/contracts/contracts/${moveTarget.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_id: destinationFolderId }),
        });
      } else {
        await fetch(`/api/contracts/folders/${moveTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: destinationFolderId }),
        });
      }
    } finally {
      setMoveTarget(null);
      load();
    }
  }

  const isEmpty = folders.length === 0 && contracts.length === 0;

  return (
    <OpsPageShell
      title={t("contracts.list.title")}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ViewToggle mode={viewMode} onChange={handleViewChange} />
          <button
            onClick={() => setShowCreateFolder(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #C9A84C",
              background: "rgba(201,168,76,0.1)",
              color: "#C9A84C",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <FolderPlus size={16} />
            {t("contracts.folders.new_folder") || "New Folder"}
          </button>
        </div>
      }
    >
      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("contracts.list.filter_category")}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-light)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            {CATEGORY_FILTERS.map((c) => (
              <option key={c} value={c}>
                {c || "all"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("contracts.list.filter_status")}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-light)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s || "all"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Breadcrumbs */}
      <FolderBreadcrumbs breadcrumbs={breadcrumbs} onNavigate={navigateToFolder} />

      {/* Content */}
      <OpsCard>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Loader2 className="animate-spin" style={{ margin: "0 auto" }} />
          </div>
        ) : isEmpty ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: 48,
              color: "var(--text-secondary)",
            }}
          >
            <FolderPlus size={40} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>
              {t("contracts.folders.empty_folder") || "This folder is empty"}
            </span>
            <button
              onClick={() => setShowCreateFolder(true)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid var(--border-light)",
                background: "var(--bg-card)",
                cursor: "pointer",
                fontSize: 13,
                color: "#C9A84C",
              }}
            >
              {t("contracts.folders.new_folder") || "New Folder"}
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* ── Grid view ─────────────────────────────────────────── */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
              padding: 12,
            }}
          >
            {folders.map((f) => (
              <FolderGridItem
                key={f.id}
                folder={f}
                onOpen={() => navigateToFolder(f.id)}
                onRename={() => setRenameTarget(f)}
                onMove={() =>
                  setMoveTarget({ type: "folder", id: f.id, excludeFolderId: f.id })
                }
                onDelete={() => handleDeleteFolder(f.id)}
              />
            ))}
            {contracts.map((c) => (
              <ContractGridItem
                key={c.id}
                contract={c}
                onOpen={() => openContract(c.id)}
                onMove={() => setMoveTarget({ type: "contract", id: c.id })}
              />
            ))}
          </div>
        ) : (
          /* ── List view ──────────────────────────────────────────── */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--text-secondary)", fontSize: 11 }}>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Category</th>
                <th style={{ padding: 8 }}>Counterparty</th>
                <th style={{ padding: 8 }}>Expires</th>
                <th style={{ padding: 8 }}>Value</th>
                <th style={{ padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {folders.map((f) => (
                <FolderListItem
                  key={f.id}
                  folder={f}
                  onOpen={() => navigateToFolder(f.id)}
                  onRename={() => setRenameTarget(f)}
                  onMove={() =>
                    setMoveTarget({ type: "folder", id: f.id, excludeFolderId: f.id })
                  }
                  onDelete={() => handleDeleteFolder(f.id)}
                />
              ))}
              {folders.length > 0 && contracts.length > 0 && (
                <tr>
                  <td colSpan={6}>
                    <div
                      style={{
                        borderTop: "2px solid var(--border-light)",
                        margin: "4px 0",
                      }}
                    />
                  </td>
                </tr>
              )}
              {contracts.map((c) => (
                <ContractListRow
                  key={c.id}
                  contract={c}
                  onOpen={() => openContract(c.id)}
                  onMove={() => setMoveTarget({ type: "contract", id: c.id })}
                />
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>

      {/* Dialogs */}
      <CreateFolderDialog
        open={showCreateFolder}
        parentId={currentFolderId}
        onClose={() => setShowCreateFolder(false)}
        onCreated={load}
      />

      {renameTarget && (
        <RenameFolderDialog
          open
          folderId={renameTarget.id}
          currentName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRenamed={load}
        />
      )}

      {moveTarget && (
        <MoveDialog
          open
          excludeFolderId={moveTarget.excludeFolderId}
          onClose={() => setMoveTarget(null)}
          onSelect={handleMoveConfirm}
        />
      )}
    </OpsPageShell>
  );
}
