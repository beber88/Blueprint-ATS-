"use client";

import { useEffect, useState, type ElementType } from "react";
import { useI18n } from "@/lib/i18n/context";

interface LocalizedTextProps {
  table: string;
  /**
   * The DB row. Reads `record.id`, `record.original_language` (or
   * `record.gen_locale`), `record.translations` and `record[field]`. We
   * intentionally accept `unknown` here — the component is used across
   * many strict row types (Application, Interview, Job, …) and they all
   * carry these columns at runtime via supabase `select("*")`.
   */
  record: unknown;
  field: string;
  /** Override the id if the record is a denormalised projection without `id`. */
  id?: string;
  /** HTML element to render. Defaults to <span>. Use "p", "h2", "div", etc. */
  as?: ElementType;
  className?: string;
  /** Render nothing instead of an empty string when the field is empty. */
  skipIfEmpty?: boolean;
}

type Translatable = {
  id?: string | null;
  original_language?: string | null;
  gen_locale?: string | null;
  translations?: Record<string, Record<string, string>> | null;
  [k: string]: unknown;
};

function asTranslatable(record: unknown): Translatable | null {
  if (!record || typeof record !== "object") return null;
  return record as Translatable;
}

function pickField(record: Translatable | null, field: string, locale: string): string {
  if (!record) return "";
  const original = (record[field] as string | null | undefined) ?? "";
  const sourceLocale = record.original_language ?? record.gen_locale ?? null;
  if (sourceLocale === locale) return String(original);
  const cached = record.translations?.[locale]?.[field];
  if (cached) return cached;
  return String(original);
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
  const row = asTranslatable(record);
  const rowId = id ?? (row?.id as string | undefined);
  const original = ((row?.[field] as string | null | undefined) ?? "");
  const initial = pickField(row, field, locale);

  const [display, setDisplay] = useState<string>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplay(pickField(row, field, locale));
  }, [row, field, locale]);

  useEffect(() => {
    if (!row || !rowId) return;
    if (!original || original.length < 2) return;

    const sourceLocale = row.original_language ?? row.gen_locale ?? null;
    if (sourceLocale === locale) return;

    const cached = row.translations?.[locale]?.[field];
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
  }, [table, rowId, field, locale, original, row]);

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
