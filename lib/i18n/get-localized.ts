import type { Locale } from "./context";

type Translatable = {
  original_language?: string | null;
  gen_locale?: string | null;
  translations?: Record<string, Record<string, string>> | null;
} & Record<string, unknown>;

/**
 * Returns the locale-appropriate value for a translatable field.
 *
 * Order of preference:
 *   1. If the row's source locale (original_language or gen_locale) matches
 *      the requested locale, the field is native — return as-is.
 *   2. If a cached translation exists in `translations[locale][field]`,
 *      return it.
 *   3. Otherwise return the original column value (caller may trigger an
 *      async translate via the LocalizedText component or /api/translate/field).
 */
export function getLocalizedField<T extends Translatable>(
  record: T | null | undefined,
  field: keyof T & string,
  locale: Locale,
): string {
  if (!record) return "";
  const original = (record[field] as unknown as string | null | undefined) ?? "";
  const sourceLocale = record.original_language ?? record.gen_locale ?? null;
  if (sourceLocale === locale) return String(original);
  const cached = record.translations?.[locale]?.[field];
  if (cached) return cached;
  return String(original);
}

/**
 * Returns true when the displayed value is the original column (either
 * because the row is native in this locale, or because no cached translation
 * exists yet and we're falling back to the source). Useful to decide whether
 * to show a "translating…" indicator.
 */
export function isOriginalShown<T extends Translatable>(
  record: T | null | undefined,
  field: keyof T & string,
  locale: Locale,
): boolean {
  if (!record) return true;
  const sourceLocale = record.original_language ?? record.gen_locale ?? null;
  if (sourceLocale === locale) return true;
  return !record.translations?.[locale]?.[field];
}
