"use client";

import { useCallback, useEffect, useState } from "react";
import { Folder, ChevronRight, Home } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ContractFolder, FolderBreadcrumb } from "@/lib/contracts/types";

interface Props {
  open: boolean;
  /** The item being moved (so we can exclude it from the tree). */
  excludeFolderId?: string;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
}

export function MoveDialog({ open, excludeFolderId, onClose, onSelect }: Props) {
  const [currentParent, setCurrentParent] = useState<string | null>(null);
  const [folders, setFolders] = useState<ContractFolder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (parentId: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (parentId) params.set("parent_id", parentId);
      const res = await fetch(`/api/contracts/folders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFolders(
          (data.folders || []).filter(
            (f: ContractFolder) => f.id !== excludeFolderId
          )
        );
        setBreadcrumbs(data.breadcrumbs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [excludeFolderId]);

  useEffect(() => {
    if (open) {
      setCurrentParent(null);
      load(null);
    }
  }, [open, load]);

  function navigate(id: string | null) {
    setCurrentParent(id);
    load(id);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Move to...</DialogTitle>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-secondary)",
            flexWrap: "wrap",
            padding: "4px 0",
          }}
        >
          <button
            onClick={() => navigate(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: currentParent ? "#C9A84C" : "var(--text-primary)",
              fontWeight: !currentParent ? 600 : 400,
              fontSize: 12,
              padding: "2px 4px",
              borderRadius: 4,
            }}
          >
            <Home size={12} /> Root
          </button>
          {breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={b.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronRight size={10} />
                {isLast ? (
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", padding: "2px 4px" }}>
                    {b.name}
                  </span>
                ) : (
                  <button
                    onClick={() => navigate(b.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#C9A84C",
                      fontSize: 12,
                      padding: "2px 4px",
                      borderRadius: 4,
                    }}
                  >
                    {b.name}
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* Folder list */}
        <div
          style={{
            border: "1px solid var(--border-light)",
            borderRadius: 6,
            maxHeight: 240,
            overflowY: "auto",
            minHeight: 80,
          }}
        >
          {loading ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              Loading...
            </div>
          ) : folders.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              No subfolders here
            </div>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate(f.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border-light)",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  textAlign: "start",
                }}
              >
                <Folder size={18} style={{ color: f.color || "#C9A84C", flexShrink: 0 }} />
                {f.name}
                <ChevronRight
                  size={14}
                  style={{ marginInlineStart: "auto", color: "var(--text-secondary)" }}
                />
              </button>
            ))
          )}
        </div>

        <DialogFooter style={{ paddingTop: 8 }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSelect(currentParent)}>
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
