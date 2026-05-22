"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";

/**
 * Inline translate control. Renders the original `text`, with a small
 * action to translate it into the current UI language. Clicking again
 * toggles back to the original. The translation is cached for the
 * lifetime of the component so re-toggling is free.
 */
export function TranslateButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const display = showing && translated ? translated : text;

  const handleClick = async () => {
    if (translated) {
      setShowing((s) => !s);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/translate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_language: locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("translate.failed"));
        return;
      }
      setTranslated(data.translated);
      setShowing(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap">{display}</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Languages className="h-3 w-3" />
        )}
        {showing && translated ? t("translate.show_original") : t("translate.translate")}
      </button>
    </div>
  );
}
