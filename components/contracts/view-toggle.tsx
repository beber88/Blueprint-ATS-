"use client";

import { LayoutGrid, List } from "lucide-react";

interface Props {
  mode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
}

export function ViewToggle({ mode, onChange }: Props) {
  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    color: "var(--text-secondary)",
  };

  return (
    <div style={{ display: "flex" }}>
      <button
        onClick={() => onChange("grid")}
        title="Grid"
        style={{
          ...btnBase,
          borderRadius: "6px 0 0 6px",
          ...(mode === "grid" ? { background: "rgba(201,168,76,0.15)", color: "#C9A84C", borderColor: "#C9A84C" } : {}),
        }}
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => onChange("list")}
        title="List"
        style={{
          ...btnBase,
          borderRadius: "0 6px 6px 0",
          borderInlineStart: "none",
          ...(mode === "list" ? { background: "rgba(201,168,76,0.15)", color: "#C9A84C", borderColor: "#C9A84C" } : {}),
        }}
      >
        <List size={16} />
      </button>
    </div>
  );
}
