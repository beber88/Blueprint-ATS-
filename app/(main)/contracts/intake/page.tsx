"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export default function ContractsIntake() {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim() && !file) {
      toast.error(t("contracts.intake.text_label"));
      return;
    }
    setBusy(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        if (text.trim()) fd.append("text", text);
        res = await fetch("/api/contracts/intake/extract", {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch("/api/contracts/intake/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `extraction failed (${res.status})`);
        return;
      }
      router.push(`/hr/contracts/preview/${data.draftId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "extraction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPageShell
      title={t("contracts.intake.title")}
      subtitle={t("contracts.intake.subtitle")}
    >
      <OpsCard>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 8,
          }}
        >
          {t("contracts.intake.upload_label")}
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={busy}
          style={{ marginBottom: 16 }}
        />

        <label
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 8,
          }}
        >
          {t("contracts.intake.text_label")}
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          disabled={busy}
          placeholder=""
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--border-light)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontFamily: "inherit",
            fontSize: 13,
            resize: "vertical",
          }}
        />

        <button
          onClick={submit}
          disabled={busy}
          style={{
            marginTop: 16,
            background: "#C9A84C",
            color: "#1A1A1A",
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {t("contracts.intake.submit")}
        </button>
      </OpsCard>
    </OpsPageShell>
  );
}
