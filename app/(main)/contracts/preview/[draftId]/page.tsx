"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { AlertTriangle, CheckCircle2, Flag, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ContractDraftRow, ContractWarning, ExtractedContract } from "@/lib/contracts/types";

const SEVERITY_COLOR: Record<string, string> = {
  high: "#A32D2D",
  medium: "#C9A84C",
  low: "#888",
};

function toDateInput(s: string | null | undefined): string {
  if (!s) return "";
  // Force ISO YYYY-MM-DD; if Claude returned something else just pass through.
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export default function ContractsPreviewPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams<{ draftId: string }>();
  const draftId = params.draftId;

  const [draft, setDraft] = useState<ContractDraftRow | null>(null);
  const [ai, setAi] = useState<ExtractedContract | null>(null);
  const [warnings, setWarnings] = useState<ContractWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/drafts/${draftId}`);
      if (!res.ok) {
        toast.error("draft not found");
        router.push("/hr/contracts/drafts");
        return;
      }
      const data = await res.json();
      setDraft(data.draft);
      setAi(data.draft.ai_output_json);
      setWarnings(data.draft.warnings_json || []);
    } finally {
      setLoading(false);
    }
  }, [draftId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchAi(updates: Partial<ExtractedContract>) {
    if (!ai) return;
    const next = { ...ai, ...updates };
    setAi(next);
    const res = await fetch(`/api/contracts/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_output: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setWarnings(data.warnings || []);
    }
  }

  async function save(flagForReview: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/drafts/${draftId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagForReview, force: false }),
      });
      const data = await res.json();
      if (res.status === 409 && data.highWarnings) {
        if (
          confirm(
            t("contracts.preview.save").concat(
              ` — ${data.highWarnings} high-severity warning(s). force save?`
            )
          )
        ) {
          const res2 = await fetch(`/api/contracts/drafts/${draftId}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flagForReview, force: true }),
          });
          if (!res2.ok) {
            toast.error((await res2.json()).error || "save failed");
            return;
          }
          const r2 = await res2.json();
          toast.success("saved");
          router.push(`/hr/contracts/contracts/${r2.contractId}`);
          return;
        }
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "save failed");
        return;
      }
      toast.success("saved");
      router.push(`/hr/contracts/contracts/${data.contractId}`);
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    if (!confirm(t("contracts.preview.discard"))) return;
    const res = await fetch(`/api/contracts/drafts/${draftId}/discard`, { method: "POST" });
    if (res.ok) {
      toast.success("discarded");
      router.push("/hr/contracts/drafts");
    } else {
      toast.error("discard failed");
    }
  }

  if (loading) {
    return (
      <OpsPageShell title={t("contracts.preview.title")}>
        <div style={{ padding: 60, textAlign: "center" }}>
          <Loader2 className="animate-spin" />
        </div>
      </OpsPageShell>
    );
  }
  if (!draft || !ai) return null;

  return (
    <OpsPageShell
      title={t("contracts.preview.title")}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => save(false)}
            disabled={saving}
            style={{
              background: "#C9A84C",
              color: "#1A1A1A",
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> {t("contracts.preview.save")}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            style={{
              background: "transparent",
              color: "#C9A84C",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #C9A84C",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Flag size={14} /> {t("contracts.preview.save_and_flag")}
          </button>
          <button
            onClick={discard}
            disabled={saving}
            style={{
              background: "transparent",
              color: "#A32D2D",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #A32D2D",
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trash2 size={14} /> {t("contracts.preview.discard")}
          </button>
        </div>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 320px",
          gap: 16,
        }}
      >
        {/* Source text (raw) */}
        <OpsCard title={t("contracts.preview.title")}>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              fontFamily: "inherit",
              color: "var(--text-secondary)",
              maxHeight: 600,
              overflow: "auto",
              margin: 0,
            }}
          >
            {draft.source_text.slice(0, 30_000)}
          </pre>
        </OpsCard>

        {/* Extracted metadata, editable */}
        <OpsCard title="metadata">
          <Field
            label={t("contracts.detail.title")}
            value={ai.title || ""}
            onChange={(v) => patchAi({ title: v })}
          />
          <Field
            label={t("contracts.detail.counterparty")}
            value={ai.counterparty_name || ""}
            onChange={(v) => patchAi({ counterparty_name: v })}
          />
          <SelectField
            label="category"
            value={ai.category || ""}
            options={[
              { v: "customer", l: t("contracts.category.customer") },
              { v: "subcontractor", l: t("contracts.category.subcontractor") },
              { v: "vendor", l: t("contracts.category.vendor") },
            ]}
            onChange={(v) => patchAi({ category: (v || null) as ExtractedContract["category"] })}
          />
          <Field
            label="signing date"
            type="date"
            value={toDateInput(ai.signing_date)}
            onChange={(v) => patchAi({ signing_date: v || null })}
          />
          <Field
            label="effective date"
            type="date"
            value={toDateInput(ai.effective_date)}
            onChange={(v) => patchAi({ effective_date: v || null })}
          />
          <Field
            label="expiration date"
            type="date"
            value={toDateInput(ai.expiration_date)}
            onChange={(v) => patchAi({ expiration_date: v || null })}
          />
          <Field
            label={`${t("contracts.detail.value")} / currency`}
            value={`${ai.monetary_value ?? ""} ${ai.currency ?? ""}`.trim()}
            onChange={(v) => {
              const parts = v.trim().split(/\s+/);
              const num = parseFloat(parts[0]);
              patchAi({
                monetary_value: isNaN(num) ? null : num,
                currency: parts[1]?.toUpperCase() || null,
              });
            }}
          />
          <Field
            label={t("contracts.detail.project")}
            value={ai.project_hint || ""}
            onChange={(v) => patchAi({ project_hint: v || null })}
          />
          <Field
            label={t("contracts.detail.summary")}
            value={ai.summary || ""}
            onChange={(v) => patchAi({ summary: v })}
          />
        </OpsCard>

        {/* Warnings sidebar */}
        <OpsCard title={t("contracts.preview.warnings_heading")}>
          {warnings.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>—</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {warnings.map((w, i) => (
                <div
                  key={`${w.code}-${i}`}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(163,45,45,0.05)",
                    borderLeft: `3px solid ${SEVERITY_COLOR[w.severity] || "#888"}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: SEVERITY_COLOR[w.severity] || "#888",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    <AlertTriangle size={12} />
                    {w.code}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {t(`contracts.warnings.${w.code}`) || w.message_en}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OpsCard>
      </div>
    </OpsPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 6,
          border: "1px solid var(--border-light)",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          fontSize: 13,
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ v: string; l: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 6,
          border: "1px solid var(--border-light)",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          fontSize: 13,
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}
