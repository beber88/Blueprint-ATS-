"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Loader2, MessageCircle, MessageSquare, Mail, Image, Type } from "lucide-react";
import { IssueChatPanel } from "@/components/operations/issue-chat-panel";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "#8A7D6B",
  in_progress: "#1A56A8",
  blocked: "#A32D2D",
  resolved: "#2D7A3E",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#A32D2D",
  high: "#C9A84C",
  medium: "#1A56A8",
  low: "#6B6356",
};

const SOURCE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  whatsapp: MessageSquare,
  text: Type,
  image: Image,
  email: Mail,
};

interface ItemDetail {
  id: string;
  issue: string;
  status: string;
  priority: string;
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
  department?: { id: string; name: string; name_he?: string; color?: string } | null;
  project?: { id: string; name: string } | null;
  employee?: { id: string; full_name: string; role?: string } | null;
  report?: {
    id: string;
    raw_text: string;
    source_type: string;
    source_meta: Record<string, unknown> | null;
    report_date: string;
    processing_status: string;
    processed_at: string | null;
    storage_path: string | null;
    created_at: string;
  } | null;
}

interface Sibling {
  id: string;
  issue: string;
  status: string;
  priority: string;
  category: string;
}

export default function ItemDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = params.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/operations/items/${id}/detail`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setItem(data.item);
        setSiblings(data.siblings || []);
      } catch {
        toast.error(t("common.error"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, t]);

  const updateStatus = async (status: string) => {
    if (!item || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/operations/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItem((prev) => prev ? { ...prev, status } : prev);
      toast.success(t("operations.toast.item_updated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString(locale === "he" ? "he-IL" : "en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <OpsPageShell title={t("operations.item_detail.title")}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 64 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      </OpsPageShell>
    );
  }

  if (!item) {
    return (
      <OpsPageShell title={t("operations.item_detail.title")}>
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>
          {t("common.not_found") || "Item not found"}
        </div>
      </OpsPageShell>
    );
  }

  const SourceIcon = SOURCE_ICONS[item.report?.source_type || ""] || FileText;

  return (
    <OpsPageShell
      title={t("operations.item_detail.title")}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowChat(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: 6,
              color: "#C9A84C",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <MessageCircle size={14} />
            {locale === "he" ? "\u05D3\u05D5\u05DF \u05D1\u05E1\u05D5\u05D2\u05D9\u05D4" : "Discuss"}
          </button>
          <select
            value={item.status}
            disabled={busy}
            onChange={(e) => updateStatus(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-primary)",
              background: STATUS_COLORS[item.status] + "20",
              color: STATUS_COLORS[item.status],
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            <option value="open">{t("operations.status.open")}</option>
            <option value="in_progress">{t("operations.status.in_progress")}</option>
            <option value="blocked">{t("operations.status.blocked")}</option>
            <option value="resolved">{t("operations.status.resolved")}</option>
          </select>
          <Link
            href="/hr/operations/issues"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: 6,
              color: "var(--text-primary)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} />
            {t("common.back") || "Back"}
          </Link>
        </div>
      }
    >
      {/* Main two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Issue card */}
          <OpsCard>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 14 }}>
              {item.issue}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Badge color={STATUS_COLORS[item.status]}>{t(`operations.status.${item.status}`)}</Badge>
              <Badge color={PRIORITY_COLORS[item.priority]}>{t(`operations.priority.${item.priority}`)}</Badge>
              <Badge color="#6B6356">{t(`operations.category.${item.category}`) || item.category}</Badge>
            </div>
          </OpsCard>

          {/* Assignment card */}
          <OpsCard title={t("operations.detail.assigned") || "Assigned Details"}>
            <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
              <Field label={t("operations.detail.person_responsible") || t("operations.col.responsible")}>
                <span style={{ color: "var(--text-primary)" }}>
                  {item.employee?.full_name || "—"}
                </span>
                {item.person_responsible_raw && item.employee?.full_name !== item.person_responsible_raw && (
                  <span style={{ color: "var(--text-secondary)", fontSize: 11, marginInlineStart: 6 }}>
                    ({item.person_responsible_raw})
                  </span>
                )}
              </Field>

              <Field label={t("operations.detail.department") || t("operations.col.dept")}>
                <span style={{ color: "var(--text-primary)" }}>
                  {item.department?.name_he || item.department?.name || "—"}
                </span>
                {item.department_raw && item.department_raw !== (item.department?.name_he || item.department?.name) && (
                  <span style={{ color: "var(--text-secondary)", fontSize: 11, marginInlineStart: 6 }}>
                    ({item.department_raw})
                  </span>
                )}
              </Field>

              <Field label={t("operations.detail.project") || t("operations.col.project")}>
                <span style={{ color: "var(--text-primary)" }}>
                  {item.project?.name || "—"}
                </span>
                {item.project_raw && item.project_raw !== item.project?.name && (
                  <span style={{ color: "var(--text-secondary)", fontSize: 11, marginInlineStart: 6 }}>
                    ({item.project_raw})
                  </span>
                )}
              </Field>

              <Field label={t("operations.detail.deadline") || t("operations.col.deadline")}>
                <span style={{ color: "var(--text-primary)" }}>
                  {item.deadline || "—"}
                  {item.deadline_uncertain && (
                    <span style={{ color: "#C9A84C", fontSize: 11, marginInlineStart: 4 }}>
                      ({t("operations.detail.uncertain") || "uncertain"})
                    </span>
                  )}
                </span>
              </Field>

              {item.ceo_decision_needed && (
                <Field label={t("operations.detail.ceo_flag")}>
                  <span style={{ background: "#5B3F9E", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    CEO
                  </span>
                </Field>
              )}

              {item.next_action && (
                <div style={{ borderInlineStart: "3px solid #C9A84C", paddingInlineStart: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#C9A84C", marginBottom: 2 }}>
                    {t("operations.detail.next_action")}
                  </div>
                  <div style={{ color: "var(--text-primary)" }}>{item.next_action}</div>
                </div>
              )}

              {item.missing_information && (
                <div style={{ borderInlineStart: "3px solid #A88B3D", paddingInlineStart: 12, background: "#A88B3D10", padding: "8px 12px", borderRadius: "0 6px 6px 0" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#A88B3D", marginBottom: 2 }}>
                    {t("operations.detail.missing_info")}
                  </div>
                  <div style={{ color: "var(--text-primary)" }}>{item.missing_information}</div>
                </div>
              )}
            </div>
          </OpsCard>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Source report metadata card */}
          <OpsCard title={t("operations.item_detail.source_report") || "Source Report"}>
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <Field label={t("operations.detail.source_type") || "Source Type"}>
                <Badge color="#6B6356">
                  <SourceIcon size={12} style={{ marginInlineEnd: 4 }} />
                  {item.report?.source_type || "—"}
                </Badge>
              </Field>

              <Field label={t("operations.detail.report_date") || "Report Date"}>
                <span style={{ color: "var(--text-primary)" }}>{item.report?.report_date || item.report_date || "—"}</span>
              </Field>

              <Field label={t("operations.detail.entered_system") || "Entered System"}>
                <span style={{ color: "var(--text-primary)" }}>{formatDate(item.report?.created_at)}</span>
              </Field>

              <Field label={t("operations.detail.processed_at") || "Processed At"}>
                <span style={{ color: "var(--text-primary)" }}>{formatDate(item.report?.processed_at)}</span>
              </Field>

              {item.report?.source_meta && (
                <Field label={t("operations.detail.confidence") || "Confidence"}>
                  <span style={{ color: "var(--text-primary)" }}>
                    {typeof (item.report.source_meta as Record<string, unknown>).confidence === "number"
                      ? `${Math.round(((item.report.source_meta as Record<string, unknown>).confidence as number) * 100)}%`
                      : "—"}
                  </span>
                </Field>
              )}
            </div>
          </OpsCard>

          {/* Raw report card (collapsible) */}
          <OpsCard>
            <button
              onClick={() => setRawExpanded(!rawExpanded)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: 0,
                width: "100%",
              }}
            >
              {rawExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {"\u05D3\u05D5\u05D7 \u05DE\u05E7\u05D5\u05E8"}
            </button>
            {rawExpanded && (
              <pre
                dir={locale === "he" ? "rtl" : "ltr"}
                style={{
                  marginTop: 12,
                  padding: 14,
                  background: "var(--bg-secondary, #1a1a1a)",
                  border: "1px solid var(--border-light)",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 400,
                  overflowY: "auto",
                  color: "var(--text-primary)",
                }}
              >
                {item.report?.raw_text || "—"}
              </pre>
            )}
          </OpsCard>
        </div>
      </div>

      {/* BOTTOM: Siblings */}
      {siblings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <OpsCard title={t("operations.item_detail.siblings") || "Related Items from Same Report"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {siblings.map((sib) => (
                <Link
                  key={sib.id}
                  href={`/hr/operations/issues/${sib.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-light)",
                    textDecoration: "none",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary, #f8f7f5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ flex: 1 }}>{sib.issue}</span>
                  <Badge color={STATUS_COLORS[sib.status]}>{t(`operations.status.${sib.status}`)}</Badge>
                  <Badge color={PRIORITY_COLORS[sib.priority]}>{t(`operations.priority.${sib.priority}`)}</Badge>
                </Link>
              ))}
            </div>
          </OpsCard>
        </div>
      )}

      {/* Responsive: collapse to 1 column on mobile */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {showChat && item && (
        <IssueChatPanel
          itemId={id}
          itemIssue={item.issue}
          onClose={() => setShowChat(false)}
        />
      )}
    </OpsPageShell>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 4,
        background: color + "20",
        color: color,
        fontWeight: 600,
        fontSize: 11,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 2 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
