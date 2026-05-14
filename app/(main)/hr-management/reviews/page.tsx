"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Review {
  id: string;
  employee_id: string;
  employee_name?: string;
  reviewer_name?: string;
  review_period?: string;
  overall_score: number | null;
  strengths?: string | null;
  improvements?: string | null;
  goals?: string | null;
  status: string;
  created_at: string;
}

interface Employee {
  id: string;
  full_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280",
  submitted: "#F59E0B",
  acknowledged: "#10B981",
};

export default function ReviewsPage() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    employee_id: "",
    review_period: "",
    overall_score: 3,
    strengths: "",
    improvements: "",
    goals: "",
  });

  const load = async () => {
    setLoading(true);
    const [rr, er] = await Promise.all([
      fetch("/api/hr/reviews").then((r) => r.json()),
      fetch("/api/operations/employees").then((r) => r.json()),
    ]);
    setReviews(rr.reviews || []);
    setEmployees(er.employees || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.employee_id) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hr/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "draft" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      setShowForm(false);
      setForm({ employee_id: "", review_period: "", overall_score: 3, strengths: "", improvements: "", goals: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const filtered = filter === "all" ? reviews : reviews.filter((r) => r.status === filter);
  const avgScore = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.overall_score || 0), 0) / reviews.filter((r) => r.overall_score).length).toFixed(1)
    : "—";

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, width: "100%",
  };

  return (
    <OpsPageShell
      title={t("hr_mgmt.reviews.title")}
      subtitle={t("hr_mgmt.reviews.subtitle")}
      actions={
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: "#C9A84C", color: "#1A1A1A",
            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          <Plus size={14} />
          {t("hr_mgmt.reviews.new_review")}
        </button>
      }
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Reviews" value={reviews.length} accent="#C9A84C" />
        <KpiCard label={t("hr_mgmt.reviews.overall_score")} value={avgScore} accent="#F59E0B" hint="Average" />
        <KpiCard label={t("hr_mgmt.reviews.draft")} value={reviews.filter((r) => r.status === "draft").length} accent="#6B7280" />
        <KpiCard label={t("hr_mgmt.reviews.submitted")} value={reviews.filter((r) => r.status === "submitted").length} accent="#3B82F6" />
      </div>

      {/* New review form */}
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select Employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            <input
              placeholder="Review Period (e.g. Q1 2026)"
              value={form.review_period}
              onChange={(e) => setForm({ ...form, review_period: e.target.value })}
              style={inputStyle}
            />
            <div>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Score (1-5)</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, overall_score: s })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                  >
                    <Star size={20} fill={s <= form.overall_score ? "#F59E0B" : "none"} color={s <= form.overall_score ? "#F59E0B" : "var(--text-secondary)"} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <textarea
              placeholder={t("hr_mgmt.reviews.strengths")}
              value={form.strengths}
              onChange={(e) => setForm({ ...form, strengths: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder={t("hr_mgmt.reviews.improvements")}
              value={form.improvements}
              onChange={(e) => setForm({ ...form, improvements: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <textarea
            placeholder={t("hr_mgmt.reviews.goals")}
            value={form.goals}
            onChange={(e) => setForm({ ...form, goals: e.target.value })}
            rows={2}
            style={{ ...inputStyle, marginTop: 12, resize: "vertical" }}
          />
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={create}
              disabled={busy}
              style={{
                padding: "8px 20px", borderRadius: 6, border: "none",
                background: "#C9A84C", color: "#1A1A1A", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
            </button>
          </div>
        </OpsCard>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["all", "draft", "submitted", "acknowledged"].map((f) => (
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
            {f === "all" ? t("hr_mgmt.email_inbox.all") : t(`hr_mgmt.reviews.${f}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : filtered.length === 0 ? (
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            {t("hr_mgmt.reviews.no_reviews")}
          </p>
        </OpsCard>
      ) : (
        <OpsCard>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Employee</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Period</th>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Score</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Reviewer</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rev) => {
                const emp = employees.find((e) => e.id === rev.employee_id);
                return (
                  <tr key={rev.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {rev.employee_name || emp?.full_name || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {rev.review_period || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {rev.overall_score != null ? (
                        <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={12} fill={s <= rev.overall_score! ? "#F59E0B" : "none"} color={s <= rev.overall_score! ? "#F59E0B" : "var(--border-light)"} />
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {rev.reviewer_name || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: `${STATUS_COLORS[rev.status] || "#6B7280"}20`,
                        color: STATUS_COLORS[rev.status] || "#6B7280",
                      }}>
                        {t(`hr_mgmt.reviews.${rev.status}`)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {format(new Date(rev.created_at), "MMM d, yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </OpsCard>
      )}
    </OpsPageShell>
  );
}
