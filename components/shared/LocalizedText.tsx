"use client";

import { useEffect, useState, type ElementType } from "react";
import { useI18n } from "@/lib/i18n/context";
import { getLocalizedField } from "@/lib/i18n/get-localized";

interface TranslatableRecord {
  id?: string | null;
  original_language?: string | null;
  gen_locale?: string | null;
  translations?: Record<string, Record<string, string>> | null;
  [k: string]: unknown;
}

interface LocalizedTextProps {
  table: string;
  record: TranslatableRecord | null | undefined;
  field: string;
  /** Override the id if the record is a denormalised projection without `id`. */
  id?: string;
  /** HTML element to render. Defaults to <span>. Use "p", "h2", "div", etc. */
  as?: ElementType;
  className?: string;
  /** Render nothing instead of an empty string when the field is empty. */
  skipIfEmpty?: boolean;
}

/**
 * Renders a translatable DB field in the user's current UI locale.
 *
 * Behaviour:
 *   - If the row's source locale matches the UI locale → render original.
 *   - Else if a cached translation exists → render the cached value.
 *   - Else → render the original immediately (no flash), then call
 *     /api/translate/field in the background, swap in the translation, and
 *     write it to the row's translations jsonb cache so subsequent views
 *     are instant.
 */
export function LocalizedText({
  table,
  record,
  field,
  id,
  as = "span",
  className,
  skipIfEmpty = false,
}: LocalizedTextProps) {
  const { locale } = useI18n();
  const rowId = id ?? (record?.id as string | undefined);
  const original = (record?.[field] as string | null | undefined) ?? "";
  const initial = record ? getLocalizedField(record, field, locale) : "";

  const [display, setDisplay] = useState<string>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplay(record ? getLocalizedField(record, field, locale) : "");
  }, [record, field, locale]);

  useEffect(() => {
    if (!record || !rowId) return;
    if (!original || original.length < 2) return;

    const sourceLocale = record.original_language ?? record.gen_locale ?? null;
    if (sourceLocale === locale) return;

    const cached = record.translations?.[locale]?.[field];
    if (cached) return;

    let aborted = false;
    setLoading(true);
    fetch("/api/translate/field", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table,
        id: rowId,
        field,
        source_text: original,
        target_locale: locale,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!aborted && data && typeof data.translated === "string") {
          setDisplay(data.translated);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!aborted) setLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [table, rowId, field, locale, original, record]);

  if (skipIfEmpty && !display) return null;

  const Tag = as as ElementType;
  return (
    <Tag
      className={className}
      style={loading ? { opacity: 0.65, transition: "opacity 0.2s" } : undefined}
    >
      {display}
    </Tag>
  );
}
