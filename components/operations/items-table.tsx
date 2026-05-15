"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import { EditItemDialog } from "@/components/operations/edit-item-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

interface Item {
  id: string;
  issue: string;
  status: "open" | "in_progress" | "blocked" | "resolved";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  deadline: string | null;
  deadline_uncertain: boolean;
  ceo_decision_needed: boolean;
  missing_information: string | null;
  next_action: string | null;
  person_responsible_raw: string | null;
  department_raw: string | null;
  project_raw: string | null;
  report_date: string;
  department?: { name: string; name_he?: string; color?: string } | null;
  project?: { name: string } | null;
  employee?: { full_name: string } | null;
  report?: { id: string; report_date: string; source_type: string } | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#A32D2D",
  high: "#C9A84C",
  medium: "#1A56A8",
  low: "#6B6356",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#8A7D6B",
  in_progress: "#1A56A8",
  blocked: "#A32D2D",
  resolved: "#2D7A3E",
};

interface Emp { id: string; full_name: string }
interface Dept { id: string; name: string; name_he: string | null }
interface Proj { id: string; name: string }

export function ItemsTable({ items, onChange, employees = [], departments = [], projects = [] }: {
  items: Item[];
  onChange?: () => void;
  employees?: Emp[];
  departments?: Dept[];
  projects?: Proj[];
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/operations/items/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.delete"));
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const updateItem = async (id: string, patch: Record<string, unknown>) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/operations/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("operations.toast.item_updated"));
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
        {t("operations.empty.no_items")}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-secondary)", textAlign: locale === "he" ? "right" : "left" }}>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.issue")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.project")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.dept")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.responsible")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.status")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.priority")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.deadline")}</th>
            <th style={{ padding: "10px 12px", fontWeight: 500 }}>{t("operations.col.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const overdue = it.deadline && it.deadline < today && it.status !== "resolved";
            const isExpanded = expandedId === it.id;
            return (
              <React.Fragment key={it.id}>
              <tr
                style={{ borderBottom: isExpanded ? "none" : "1px solid var(--border-light)", cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : it.id)}
              >
                <td style={{ padding: "10px 12px", verticalAlign: "top", maxWidth: 360 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    {isExpanded ? <ChevronDown size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--text-secondary)" }} /> : <ChevronRight size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--text-secondary)" }} />}
                    {it.ceo_decision_needed && (
                      <span title={t("operations.flag.ceo")} style={{ background: "#5B3F9E", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>CEO</span>
                    )}
                    {it.missing_information && (
                      <AlertTriangle size={14} style={{ color: "#C9A84C", flexShrink: 0, marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ marginTop: 2 }}>{it.issue}</div>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{it.project?.name || it.project_raw || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  {it.department?.name_he || it.department?.name || it.department_raw || "—"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{it.employee?.full_name || it.person_responsible_raw || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  <select
                    value={it.status}
                    disabled={busy === it.id}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateItem(it.id, { status: e.target.value })}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--border-primary)",
                      background: STATUS_COLORS[it.status] + "20",
                      color: STATUS_COLORS[it.status],
                      fontWeight: 500,
                      fontSize: 12,
                    }}
                  >
                    <option value="open">{t("operations.status.open")}</option>
                    <option value="in_progress">{t("operations.status.in_progress")}</option>
                    <option value="blocked">{t("operations.status.blocked")}</option>
                    <option value="resolved">{t("operations.status.resolved")}</option>
                  </select>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: PRIORITY_COLORS[it.priority] + "20",
                      color: PRIORITY_COLORS[it.priority],
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    {t(`operations.priority.${it.priority}`)}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  {it.deadline ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: overdue ? "#A32D2D" : "var(--text-primary)", fontWeight: overdue ? 600 : 400 }}>
                      {overdue ? <AlertTriangle size={13} /> : <Calendar size={13} />}
                      {it.deadline}
                      {it.deadline_uncertain && <span style={{ color: "#C9A84C", fontSize: 10 }}>?</span>}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                    {busy === it.id ? <Loader2 size={14} className="animate-spin" /> : null}
                    {it.status !== "resolved" && (
                      <button
                        onClick={() => updateItem(it.id, { status: "resolved" })}
                        title={t("operations.actions.mark_resolved")}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#2D7A3E", padding: 4 }}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    {it.status === "resolved" && (
                      <button
                        onClick={() => updateItem(it.id, { status: "open" })}
                        title={t("operations.actions.reopen")}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8A7D6B", padding: 4 }}
                      >
                        <Clock size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setEditTarget(it)}
                      title={t("common.edit")}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4 }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(it)}
                      title={t("common.delete")}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A32D2D", padding: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
              {isExpanded && (
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <div style={{
                      padding: "16px 20px",
                      background: "var(--bg-secondary, #f8f7f5)",
                      borderInlineStart: "3px solid #C9A84C",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px 24px",
                      fontSize: 13,
                    }}>
                      {it.next_action && (
                        <DetailField label={t("operations.detail.next_action")} value={it.next_action} accent="#1A56A8" />
                      )}
                      {it.missing_information && (
                        <DetailField label={t("operations.detail.missing_info")} value={it.missing_information} accent="#A88B3D" />
                      )}
                      <DetailField label={t("operations.detail.category")} value={t("operations.category." + it.category) || it.category} />
                      <DetailField label={t("operations.detail.report_source")} value={`${it.report_date}${it.report ? ` · ${it.report.source_type}` : ""}`} />
                      {it.ceo_decision_needed && (
                        <DetailField label={t("operations.detail.ceo_flag")} value="✓" accent="#5B3F9E" />
                      )}
                      {it.person_responsible_raw && (
                        <DetailField label={t("operations.detail.person_raw")} value={it.person_responsible_raw} />
                      )}
                      {it.department_raw && (
                        <DetailField label={t("operations.detail.dept_raw")} value={it.department_raw} />
                      )}
                      {it.project_raw && (
                        <DetailField label={t("operations.detail.project_raw")} value={it.project_raw} />
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {editTarget && (
        <EditItemDialog
          open={!!editTarget}
          item={editTarget}
          employees={employees}
          departments={departments}
          projects={projects}
          onClose={() => setEditTarget(null)}
          onUpdated={() => { setEditTarget(null); onChange?.(); }}
        />
      )}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title={t("common.confirm_delete_title")}
        message={t("common.confirm_delete_message")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}

function DetailField({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: accent || "var(--text-secondary)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
