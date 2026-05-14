"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Mail, RefreshCw, Eye } from "lucide-react";
import { format } from "date-fns";

interface HrEmail {
  id: string;
  gmail_message_id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  classification: {
    category: string;
    confidence: number;
    summary: string;
    employee_name: string | null;
  } | null;
  routed_to: string | null;
  processing_status: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  classified: "#3B82F6",
  routed: "#10B981",
  failed: "#EF4444",
  ignored: "#6B7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  leave_request: "Leave Request",
  sick_day: "Sick Day",
  attendance_report: "Attendance",
  employee_update: "Employee Update",
  salary_query: "Salary",
  equipment_request: "Equipment",
  training_request: "Training",
  onboarding_task: "Onboarding",
  offboarding_task: "Offboarding",
  performance_review: "Review",
  shift_change: "Shift",
  general_hr: "General HR",
  not_hr: "Not HR",
};

export default function EmailInboxPage() {
  const { t } = useI18n();
  const [emails, setEmails] = useState<HrEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<HrEmail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const res = await fetch(`/api/hr/email?${params}`);
    const data = await res.json();
    setEmails(data.emails || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const triggerIngest = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/hr/email/ingest", { method: "POST" });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const filters = ["all", "pending", "classified", "routed", "failed", "ignored"];

  return (
    <OpsPageShell
      title={t("hr_mgmt.email_inbox.title")}
      subtitle={t("hr_mgmt.email_inbox.subtitle")}
      actions={
        <button
          onClick={triggerIngest}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: "#C9A84C", color: "#1A1A1A",
            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Fetch Emails
        </button>
      }
    >
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer",
              background: filter === f ? "rgba(201,168,76,0.15)" : "var(--bg-card)",
              color: filter === f ? "#C9A84C" : "var(--text-secondary)",
              borderWidth: 1, borderStyle: "solid",
              borderColor: filter === f ? "rgba(201,168,76,0.35)" : "var(--border-light)",
            }}
          >
            {t(`hr_mgmt.email_inbox.${f}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : emails.length === 0 ? (
        <OpsCard>
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            <Mail size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p>{t("hr_mgmt.email_inbox.no_emails")}</p>
          </div>
        </OpsCard>
      ) : (
        <div style={{ display: "flex", gap: 16 }}>
          {/* Email list */}
          <div style={{ flex: selectedEmail ? "0 0 400px" : 1 }}>
            <OpsCard>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.email_inbox.from")}</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.email_inbox.subject")}</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.email_inbox.category")}</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.email_inbox.status")}</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.email_inbox.received")}</th>
                    <th style={{ padding: "8px 12px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => (
                    <tr
                      key={email.id}
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        background: selectedEmail?.id === email.id ? "rgba(201,168,76,0.08)" : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {email.from_name || email.from_email}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {email.subject || "(no subject)"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {email.classification ? (
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: "rgba(201,168,76,0.1)", color: "#C9A84C",
                          }}>
                            {CATEGORY_LABELS[email.classification.category] || email.classification.category}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                          background: `${STATUS_COLORS[email.processing_status] || "#6B7280"}20`,
                          color: STATUS_COLORS[email.processing_status] || "#6B7280",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[email.processing_status] || "#6B7280" }} />
                          {email.processing_status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
                        {format(new Date(email.received_at), "MMM d, HH:mm")}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </OpsCard>
          </div>

          {/* Email detail panel */}
          {selectedEmail && (
            <div style={{ flex: 1, minWidth: 300 }}>
              <OpsCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                      {selectedEmail.subject || "(no subject)"}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                      {selectedEmail.from_name || selectedEmail.from_email} &middot; {format(new Date(selectedEmail.received_at), "PPp")}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 18 }}
                  >
                    &times;
                  </button>
                </div>

                {selectedEmail.classification && (
                  <div style={{
                    padding: 12, borderRadius: 8, marginBottom: 16,
                    background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      AI Classification
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                      <strong>Category:</strong> {CATEGORY_LABELS[selectedEmail.classification.category] || selectedEmail.classification.category}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                      <strong>Confidence:</strong> {Math.round(selectedEmail.classification.confidence * 100)}%
                    </div>
                    {selectedEmail.classification.employee_name && (
                      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                        <strong>Employee:</strong> {selectedEmail.classification.employee_name}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                      {selectedEmail.classification.summary}
                    </div>
                  </div>
                )}

                <div style={{
                  padding: 12, borderRadius: 8,
                  background: "var(--bg-secondary, rgba(0,0,0,0.03))",
                  fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)",
                  whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto",
                }}>
                  {selectedEmail.body_text || "(empty body)"}
                </div>
              </OpsCard>
            </div>
          )}
        </div>
      )}
    </OpsPageShell>
  );
}
