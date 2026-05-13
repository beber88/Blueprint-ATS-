"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Layers } from "lucide-react";

interface BulkResult {
  jobId: string;
  status: "done" | "failed" | "cancelled";
  totalReports: number;
  counts: Record<string, number>;
}

interface BulkPreview {
  detectedReports: number;
  dateRange: { from: string | null; to: string | null };
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  capExceeded: boolean;
  cap: number;
  sourceTextHash: string;
  duplicateJobId?: string;
  duplicateJobCreatedAt?: string;
}

export default function IntakePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [bulkConsent, setBulkConsent] = useState(false);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/operations/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!text.trim() && !file) {
      toast.error(t("operations.intake.error_empty"));
      return;
    }
    setBusy(true);
    setBulkResult(null);
    try {
      // New flow: extract → draft → preview/[draftId]. The Preview page
      // owns Save / Save & Flag / Discard.
      const fd = new FormData();
      if (file) fd.set("file", file);
      if (text.trim()) fd.set("text", text);
      if (reportDate) fd.set("reportDate", reportDate);
      if (projectId) fd.set("projectId", projectId);

      const res = await fetch("/api/operations/intake/extract", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extract failed");
      toast.success(t("operations.intake.draft_created"));
      router.push(`/hr/operations/intake/preview/${data.draftId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const previewBulk = async () => {
    if (!text.trim() || text.trim().length < 100) {
      toast.error(t("operations.intake.bulk_error_short"));
      return;
    }
    setBusy(true);
    setBulkPreview(null);
    setBulkResult(null);
    setBulkConsent(false);
    try {
      const res = await fetch("/api/operations/bulk-import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      // 422 still returns a useful preview body (with capExceeded=true).
      if (!res.ok && res.status !== 422) {
        throw new Error(data.error || "Preview failed");
      }
      setBulkPreview(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (force = false) => {
    if (!bulkPreview || bulkPreview.capExceeded || !bulkConsent) return;
    setBusy(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/operations/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          defaultProjectId: projectId || undefined,
          expectedReports: bulkPreview.detectedReports,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.duplicateJobId) {
          // Duplicate — let the user decide to force.
          throw new Error(data.error || "Duplicate batch detected.");
        }
        throw new Error(data.error || "Bulk import failed");
      }
      setBulkResult(data);
      setBulkJobId(data.jobId);
      toast.success(
        t("operations.intake.bulk_success")
          .replace("{r}", String(data.counts?.done || 0))
          .replace("{i}", String(data.totalReports))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const cancelBulk = async () => {
    if (!bulkJobId) return;
    try {
      await fetch(`/api/operations/bulk-import/jobs/${bulkJobId}/cancel`, {
        method: "POST",
      });
      toast.success(t("operations.intake.bulk_cancelled"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <OpsPageShell title={t("operations.intake.title")} subtitle={t("operations.intake.subtitle")}>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, marginBottom: 12 }}>
        {([
          { v: "single", label: t("operations.intake.mode_single"), icon: FileText },
          { v: "bulk", label: t("operations.intake.mode_bulk"), icon: Layers },
        ] as const).map((m) => (
          <button
            key={m.v}
            onClick={() => setMode(m.v)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              background: mode === m.v ? "#C9A84C" : "transparent",
              color: mode === m.v ? "#1A1A1A" : "var(--text-secondary)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <OpsCard title={mode === "bulk" ? t("operations.intake.bulk_text_label") : t("operations.intake.text_label")}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "bulk" ? t("operations.intake.bulk_placeholder") : t("operations.intake.text_placeholder")}
            rows={mode === "bulk" ? 24 : 14}
            dir={locale === "he" ? "rtl" : "ltr"}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.6,
              resize: "vertical",
            }}
          />
          {mode === "bulk" && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              {t("operations.intake.bulk_hint")}
            </p>
          )}
        </OpsCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "single" && (
            <OpsCard title={t("operations.intake.file_label")}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: 12,
                  border: "1px dashed var(--border-primary)",
                  borderRadius: 8,
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Upload size={16} />
                {file ? file.name : t("operations.intake.choose_file")}
              </button>
            </OpsCard>
          )}

          <OpsCard title={t("operations.intake.options")}>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              {t("operations.intake.report_date")}
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", marginBottom: 12 }}
            />
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              {t("operations.intake.project_hint")}
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)" }}
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </OpsCard>

          {mode === "single" ? (
            <button
              disabled={busy}
              onClick={submit}
              style={{
                padding: "12px 16px",
                background: "#C9A84C",
                color: "#1A1A1A",
                border: "none",
                borderRadius: 8,
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {busy ? t("operations.intake.processing") : t("operations.intake.submit")}
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={previewBulk}
              style={{
                padding: "12px 16px",
                background: "#C9A84C",
                color: "#1A1A1A",
                border: "none",
                borderRadius: 8,
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
              {busy ? t("operations.intake.processing") : t("operations.intake.bulk_preview")}
            </button>
          )}
        </div>
      </div>

      {mode === "bulk" && bulkPreview && (
        <OpsCard title={t("operations.intake.bulk_preview_title")} style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("operations.intake.bulk_preview_detected")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: bulkPreview.capExceeded ? "#A32D2D" : "var(--text-primary)" }}>
                {bulkPreview.detectedReports}
                {bulkPreview.capExceeded && (
                  <span style={{ fontSize: 12, marginLeft: 6, color: "#A32D2D" }}>
                    / {bulkPreview.cap}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("operations.intake.bulk_preview_date_range")}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {bulkPreview.dateRange.from || "—"}
                {" → "}
                {bulkPreview.dateRange.to || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("operations.intake.bulk_preview_input_tokens")}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {bulkPreview.estimatedInputTokens.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("operations.intake.bulk_preview_output_tokens")}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {bulkPreview.estimatedOutputTokens.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("operations.intake.bulk_preview_cost")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#C9A84C" }}>
                ${bulkPreview.estimatedCostUsd.toFixed(4)}
              </div>
            </div>
          </div>

          {bulkPreview.capExceeded && (
            <div style={{ background: "#FBEAEA", color: "#7A1F1F", padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 10 }}>
              {t("operations.intake.bulk_cap_exceeded").replace("{cap}", String(bulkPreview.cap))}
            </div>
          )}
          {bulkPreview.duplicateJobId && (
            <div style={{ background: "#FFF7E6", color: "#7A5A1F", padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 10 }}>
              {t("operations.intake.bulk_duplicate_warning").replace(
                "{at}",
                bulkPreview.duplicateJobCreatedAt || ""
              )}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={bulkConsent}
              onChange={(e) => setBulkConsent(e.target.checked)}
              disabled={bulkPreview.capExceeded}
            />
            {t("operations.intake.bulk_consent")}
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={busy || !bulkConsent || bulkPreview.capExceeded}
              onClick={() => runBulk(Boolean(bulkPreview.duplicateJobId))}
              style={{
                padding: "10px 14px",
                background: "#C9A84C",
                color: "#1A1A1A",
                border: "none",
                borderRadius: 8,
                cursor: busy || !bulkConsent || bulkPreview.capExceeded ? "not-allowed" : "pointer",
                fontWeight: 600,
                opacity: !bulkConsent || bulkPreview.capExceeded ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
              {t("operations.intake.bulk_run")}
            </button>
            {busy && bulkJobId && (
              <button
                onClick={cancelBulk}
                style={{
                  padding: "10px 14px",
                  background: "transparent",
                  color: "#A32D2D",
                  border: "1px solid #A32D2D",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {t("operations.intake.bulk_cancel")}
              </button>
            )}
          </div>
        </OpsCard>
      )}

      {bulkResult && (
        <OpsCard title={t("operations.intake.bulk_result_title")} style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 14 }}>
            {t("operations.intake.bulk_job_summary")
              .replace("{status}", bulkResult.status)
              .replace("{r}", String(bulkResult.totalReports))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            {t("operations.intake.bulk_job_id")}: <code>{bulkResult.jobId}</code>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.entries(bulkResult.counts).map(([k, v]) => (
              <div key={k} style={{ padding: "6px 10px", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 6, fontSize: 13 }}>
                <b>{v}</b> <span style={{ color: "var(--text-secondary)" }}>{k}</span>
              </div>
            ))}
          </div>
        </OpsCard>
      )}

    </OpsPageShell>
  );
}
