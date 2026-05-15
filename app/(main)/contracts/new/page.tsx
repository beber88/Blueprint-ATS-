"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";
import { ArrowLeft, Sparkles, Loader2, AlertTriangle, FileSignature } from "lucide-react";
import { toast } from "sonner";

interface ExtractedDraft {
  title: string;
  category: string;
  counterparty_name: string;
  counterparty_contact_name: string | null;
  counterparty_contact_email: string | null;
  counterparty_contact_phone: string | null;
  summary: string;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  is_renewable: boolean;
  obligations: { party: string; obligation: string; due_date?: string | null }[];
  warnings: string[];
  language: string;
}

const CATEGORIES = ["employment", "service", "supply", "subcontract", "lease", "nda", "consulting", "purchase", "other"];

export default function NewContractPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [tab, setTab] = useState<"ai" | "manual">("ai");
  const [sourceText, setSourceText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [obligations, setObligations] = useState<ExtractedDraft["obligations"]>([]);

  const [form, setForm] = useState({
    title: "",
    category: "service",
    counterparty_name: "",
    counterparty_contact_name: "",
    counterparty_contact_email: "",
    counterparty_contact_phone: "",
    summary: "",
    signing_date: "",
    effective_date: "",
    expiration_date: "",
    renewal_date: "",
    monetary_value: "",
    currency: "ILS",
    is_renewable: false,
    status: "active",
  });

  const handleExtract = async () => {
    if (sourceText.trim().length < 50) {
      toast.error(t("contracts.new.too_short"));
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/api/contracts/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_text: sourceText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || t("contracts.new.extract_failed"));
        return;
      }
      const ext: ExtractedDraft = data.extracted;
      setDraftId(data.draft.id);
      setWarnings(ext.warnings || []);
      setObligations(ext.obligations || []);
      setForm({
        title: ext.title,
        category: ext.category,
        counterparty_name: ext.counterparty_name,
        counterparty_contact_name: ext.counterparty_contact_name || "",
        counterparty_contact_email: ext.counterparty_contact_email || "",
        counterparty_contact_phone: ext.counterparty_contact_phone || "",
        summary: ext.summary,
        signing_date: ext.signing_date || "",
        effective_date: ext.effective_date || "",
        expiration_date: ext.expiration_date || "",
        renewal_date: ext.renewal_date || "",
        monetary_value: ext.monetary_value != null ? String(ext.monetary_value) : "",
        currency: ext.currency || "ILS",
        is_renewable: ext.is_renewable,
        status: "active",
      });
      setTab("manual");
      toast.success(t("contracts.new.extracted_ok"));
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.counterparty_name || !form.category) {
      toast.error(t("contracts.new.required_fields"));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        monetary_value: form.monetary_value ? Number(form.monetary_value) : null,
        signing_date: form.signing_date || null,
        effective_date: form.effective_date || null,
        expiration_date: form.expiration_date || null,
        renewal_date: form.renewal_date || null,
        obligations,
        flagged_for_review: warnings.length > 0,
        draft_source_id: draftId,
      };
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("contracts.new.save_failed"));
        return;
      }
      toast.success(t("contracts.new.saved"));
      router.push(`/contracts/${data.id}`);
    } finally {
      setSaving(false);
    }
  };

  const update = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/contracts" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          {t("contracts.title")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("contracts.new.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("contracts.new.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant="ghost"
          onClick={() => setTab("ai")}
          className={`relative rounded-none px-4 ${tab === "ai" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Sparkles className="me-2 h-4 w-4" />
          {t("contracts.new.tab_ai")}
          {tab === "ai" && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setTab("manual")}
          className={`relative rounded-none px-4 ${tab === "manual" ? "text-primary" : "text-muted-foreground"}`}
        >
          <FileSignature className="me-2 h-4 w-4" />
          {t("contracts.new.tab_manual")}
          {tab === "manual" && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />}
        </Button>
      </div>

      {tab === "ai" ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <Label htmlFor="source">{t("contracts.new.paste_label")}</Label>
            <p className="mb-2 text-xs text-muted-foreground">{t("contracts.new.paste_help")}</p>
            <Textarea
              id="source"
              rows={14}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t("contracts.new.paste_placeholder")}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handleExtract} disabled={extracting || sourceText.trim().length < 50}>
                {extracting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                {t("contracts.new.extract")}
              </Button>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                {t("contracts.new.ai_warnings")}
              </div>
              <ul className="ms-5 list-disc space-y-0.5 text-xs text-amber-900">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("contracts.form.title")} required>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.category")} required>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label={t("contracts.form.counterparty")} required>
              <Input value={form.counterparty_name} onChange={(e) => update("counterparty_name", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.counterparty_contact_name")}>
              <Input value={form.counterparty_contact_name} onChange={(e) => update("counterparty_contact_name", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.counterparty_contact_email")}>
              <Input type="email" value={form.counterparty_contact_email} onChange={(e) => update("counterparty_contact_email", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.counterparty_contact_phone")}>
              <Input value={form.counterparty_contact_phone} onChange={(e) => update("counterparty_contact_phone", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.signing_date")}>
              <Input type="date" value={form.signing_date} onChange={(e) => update("signing_date", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.effective_date")}>
              <Input type="date" value={form.effective_date} onChange={(e) => update("effective_date", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.expiration_date")}>
              <Input type="date" value={form.expiration_date} onChange={(e) => update("expiration_date", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.renewal_date")}>
              <Input type="date" value={form.renewal_date} onChange={(e) => update("renewal_date", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.monetary_value")}>
              <Input type="number" value={form.monetary_value} onChange={(e) => update("monetary_value", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.currency")}>
              <Input value={form.currency} onChange={(e) => update("currency", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.summary")} className="sm:col-span-2">
              <Textarea rows={3} value={form.summary} onChange={(e) => update("summary", e.target.value)} />
            </FormField>
            <FormField label={t("contracts.form.is_renewable")} className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_renewable}
                  onChange={(e) => update("is_renewable", e.target.checked)}
                />
                {t("contracts.form.renewable_help")}
              </label>
            </FormField>
          </div>

          {obligations.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("contracts.form.obligations")} ({obligations.length})
              </div>
              <ul className="space-y-1 text-xs">
                {obligations.map((o, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="rounded bg-card px-1.5 py-0.5 font-mono">{o.party}</span>
                    <span>{o.obligation}</span>
                    {o.due_date && <span className="text-muted-foreground">({o.due_date})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Link href="/contracts">
              <Button variant="ghost">{t("common.cancel")}</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("contracts.new.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-1 ${className || ""}`}>
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
