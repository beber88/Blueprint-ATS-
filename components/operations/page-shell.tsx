"use client";

import { ReactNode } from "react";

export function OpsPageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>{title}</h1>
          {subtitle && <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: 13 }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function OpsCard({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        borderRadius: 10,
        padding: 16,
        ...style,
      }}
    >
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  accent?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        borderRadius: 10,
        padding: 16,
        borderTop: `3px solid ${accent || "#C9A84C"}`,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 6 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
