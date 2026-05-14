"use client";

import { ChevronRight, Home } from "lucide-react";
import type { FolderBreadcrumb } from "@/lib/contracts/types";

interface Props {
  breadcrumbs: FolderBreadcrumb[];
  onNavigate: (folderId: string | null) => void;
}

export function FolderBreadcrumbs({ breadcrumbs, onNavigate }: Props) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        color: "var(--text-secondary)",
        padding: "8px 0",
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={() => onNavigate(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: breadcrumbs.length > 0 ? "#C9A84C" : "var(--text-primary)",
          fontWeight: breadcrumbs.length === 0 ? 600 : 400,
          padding: "4px 6px",
          borderRadius: 4,
          fontSize: 13,
        }}
      >
        <Home size={14} />
        <span>All Contracts</span>
      </button>

      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronRight size={12} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            {isLast ? (
              <span style={{ fontWeight: 600, color: "var(--text-primary)", padding: "4px 6px" }}>
                {crumb.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(crumb.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#C9A84C",
                  padding: "4px 6px",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                {crumb.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
