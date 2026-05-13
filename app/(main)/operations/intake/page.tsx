"use client";

import { useEffect, useRef, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Layers } from "lucide-react";
import { ItemsTable } from "@/components/operations/items-table";

interface IngestResult {
  report_id: string;
  items_count: number;
  confidence: number;
  report_date: string;
  notes: string | null;
}

interface BulkResult {
  reports: Array<{ id: string; report_date: string; items_count: number }>;
  total_items: number;
  chunks_detected: number;
}

export default function IntakePage() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [items, setItems] = useState<unknown[]>([]);
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
    setResult(null);
    setBulkResult(null);
    setItems([]);
    try {
      const fd = new FormData();
      if (file) fd.set("file", file);
      if (text.trim()) fd.set("text", text);
      if (reportDate) fd.set("reportDate", reportDate);
      if (projectId) fd.set("projectId", projectId);

      const res = await fetch("/api/operations/reports/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingest failed");
      setResult(data);
      toast.success(t("operations.intake.success").replace("{n}", String(data.items_count)));

      const itemsRes = await fetch(`/api/operations/reports/${data.report_id}`);
      const itemsData = await itemsRes.json();
      if (itemsRes.ok) setItems(itemsData.items || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    if (!text.trim() || text.trim().length < 100) {
      toast.error(t("operations.intake.bulk_error_short"));
      return;
    }
    setBusy(true);
    setResult(null);
    setBulkResult(null);
    setItems([]);
    try {
      const res = await fetch("/api/operations/reports/bulk-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, defaultProjectId: projectId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk ingest failed");
      setBulkResult(data);
      toast.success(t("operations.intake.bulk_success").replace("{r}", String(data.reports.length)).replace("{i}", String(data.total_items)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
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

          <button
            disabled={busy}
            onClick={mode === "bulk" ? submitBulk : submit}
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
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "bulk" ? <Layers size={16} /> : <FileText size={16} />}
            {busy ? t("operations.intake.processing") : mode === "bulk" ? t("operations.intake.bulk_submit") : t("operations.intake.submit")}
          </button>
        </div>
      </div>

      {bulkResult && (
        <OpsCard title={t("operations.intake.bulk_result_title")} style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            {t("operations.intake.bulk_summary")
              .replace("{r}", String(bulkResult.reports.length))
              .replace("{i}", String(bulkResult.total_items))
              .replace("{c}", String(bulkResult.chunks_detected))}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {bulkResult.reports.map((r) => (
              <li key={r.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{r.report_date}</span>
                <span style={{ color: "var(--text-secondary)" }}>{r.items_count} items</span>
              </li>
            ))}
          </ul>
        </OpsCard>
      )}

      {result && (
        <OpsCard title={t("operations.intake.result_title")} style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            {t("operations.intake.extracted")}: <b>{result.items_count}</b> · {t("operations.intake.confidence")}: <b>{Math.round(result.confidence * 100)}%</b>
          </div>
          {result.notes && (
            <div style={{ background: "#FAF8F5", padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13, color: "var(--text-secondary)" }}>
              {result.notes}
            </div>
          )}
          <ItemsTable items={items as never} />
        </OpsCard>
      )}
    </OpsPageShell>
  );
}
