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
import { Loader2, FolderPlus, ArrowUpDown } from "lucide-react";
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
type SortKey = "title" | "counterparty" | "value" | "date" | "category" | "status";

function getStoredView(): "grid" | "list" {
  if (typeof window === "undefined") return "list";
  return (localStorage.getItem("contracts_view") as "grid" | "list") || "list";
}

function sortContracts(items: ContractItem[], key: SortKey, asc: boolean): ContractItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "counterparty": cmp = a.counterparty_name.localeCompare(b.counterparty_name); break;
      case "value": cmp = (a.monetary_value || 0) - (b.monetary_value || 0); break;
      case "date": cmp = (a.created_at || "").localeCompare(b.created_at || ""); break;
      case "category": cmp = a.category.localeCompare(b.category); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
    }
    return asc ? cmp : -cmp;
  });
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
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortAsc, setSortAsc] = useState(true);
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
    router.push(`/hr/contracts/contracts/${id}`);
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm(t("contracts.folders.confirm_delete"))) return;
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = sortContracts(contracts, sortKey, sortAsc);
  const isEmpty = folders.length === 0 && contracts.length === 0;

  // Group contracts by category for grid view
  const grouped = new Map<string, ContractItem[]>();
  if (sortKey === "category") {
    for (const c of sorted) {
      const arr = grouped.get(c.category) || [];
      arr.push(c);
      grouped.set(c.category, arr);
    }
  }

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
            {t("contracts.folders.new_folder")}
          </button>
        </div>
      }
    >
      {/* Filters + Sort */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("contracts.list.filter_category")}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}
          >
            {CATEGORY_FILTERS.map((c) => (
              <option key={c} value={c}>
                {c ? (t(`contracts.category.${c}`) || c) : t("contracts.list.filter_all") || "All"}
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
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s ? (t(`contracts.status.${s}`) || s) : t("contracts.list.filter_all") || "All"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            <ArrowUpDown size={10} style={{ display: "inline", verticalAlign: "middle" }} />
            {" "}{t("contracts.list.sort_by") || "Sort by"}
          </div>
          <select
            value={sortKey}
            onChange={(e) => handleSort(e.target.value as SortKey)}
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="category">{t("contracts.list.col_category")}</option>
            <option value="title">{t("contracts.list.col_name")}</option>
            <option value="counterparty">{t("contracts.list.col_counterparty")}</option>
            <option value="value">{t("contracts.list.col_value")}</option>
            <option value="date">{t("contracts.list.sort_date") || "Date"}</option>
            <option value="status">{t("contracts.list.col_status")}</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", paddingBottom: 6 }}>
          {contracts.length} {t("contracts.list.title")?.toLowerCase() || "contracts"}
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48, color: "var(--text-secondary)" }}>
            <FolderPlus size={40} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>{t("contracts.folders.empty_folder")}</span>
          </div>
        ) : viewMode === "grid" ? (
          /* ── Grid view — grouped by category ──────────────────── */
          <div style={{ padding: 16 }}>
            {/* Folders first */}
            {folders.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                  {folders.map((f) => (
                    <FolderGridItem
                      key={f.id}
                      folder={f}
                      onOpen={() => navigateToFolder(f.id)}
                      onRename={() => setRenameTarget(f)}
                      onMove={() => setMoveTarget({ type: "folder", id: f.id, excludeFolderId: f.id })}
                      onDelete={() => handleDeleteFolder(f.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Contracts grouped by category or flat */}
            {sortKey === "category" ? (
              Array.from(grouped.entries()).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-secondary)",
                    borderBottom: "1px solid var(--border-light)",
                    paddingBottom: 6,
                    marginBottom: 12,
                  }}>
                    {t(`contracts.category.${cat}`) || cat} ({items.length})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                    {items.map((c) => (
                      <ContractGridItem
                        key={c.id}
                        contract={c}
                        onOpen={() => openContract(c.id)}
                        onMove={() => setMoveTarget({ type: "contract", id: c.id })}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {sorted.map((c) => (
                  <ContractGridItem
                    key={c.id}
                    contract={c}
                    onOpen={() => openContract(c.id)}
                    onMove={() => setMoveTarget({ type: "contract", id: c.id })}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── List view ──────────────────────────────────────────── */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--text-secondary)", fontSize: 11 }}>
                <SortHeader label={t("contracts.list.col_name")} field="title" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label={t("contracts.list.col_category")} field="category" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label={t("contracts.list.col_counterparty")} field="counterparty" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <th style={{ padding: 8 }}>{t("contracts.list.col_expires")}</th>
                <SortHeader label={t("contracts.list.col_value")} field="value" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label={t("contracts.list.col_status")} field="status" current={sortKey} asc={sortAsc} onClick={handleSort} />
              </tr>
            </thead>
            <tbody>
              {folders.map((f) => (
                <FolderListItem
                  key={f.id}
                  folder={f}
                  onOpen={() => navigateToFolder(f.id)}
                  onRename={() => setRenameTarget(f)}
                  onMove={() => setMoveTarget({ type: "folder", id: f.id, excludeFolderId: f.id })}
                  onDelete={() => handleDeleteFolder(f.id)}
                />
              ))}
              {folders.length > 0 && contracts.length > 0 && (
                <tr><td colSpan={6}><div style={{ borderTop: "2px solid var(--border-light)", margin: "4px 0" }} /></td></tr>
              )}
              {sorted.map((c) => (
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
      <CreateFolderDialog open={showCreateFolder} parentId={currentFolderId} onClose={() => setShowCreateFolder(false)} onCreated={load} />
      {renameTarget && (
        <RenameFolderDialog open folderId={renameTarget.id} currentName={renameTarget.name} onClose={() => setRenameTarget(null)} onRenamed={load} />
      )}
      {moveTarget && (
        <MoveDialog open excludeFolderId={moveTarget.excludeFolderId} onClose={() => setMoveTarget(null)} onSelect={handleMoveConfirm} />
      )}
    </OpsPageShell>
  );
}

function SortHeader({ label, field, current, asc, onClick }: {
  label: string;
  field: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (k: SortKey) => void;
}) {
  const active = current === field;
  return (
    <th
      onClick={() => onClick(field)}
      style={{
        padding: 8,
        cursor: "pointer",
        userSelect: "none",
        color: active ? "#C9A84C" : "var(--text-secondary)",
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
      {active && <span style={{ marginInlineStart: 4, fontSize: 9 }}>{asc ? "▲" : "▼"}</span>}
    </th>
  );
}
