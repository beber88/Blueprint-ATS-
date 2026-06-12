import type { SupabaseClient } from "@supabase/supabase-js";
import { translateText } from "./translate";

export type FieldLocale = "he" | "en" | "tl";

// Whitelisted tables that have the translations jsonb column added by
// migrations 004 (ATS/HR side) and 019 (Operations + HR mail). Adding a
// new table here requires the corresponding ADD COLUMN in a migration.
export const TRANSLATABLE_TABLES = new Set<string>([
  "candidates",
  "jobs",
  "applications",
  "candidate_job_matches",
  "interviews",
  "message_templates",
  "hr_employee_documents",
  "hr_employee_timeline",
  "ct_contracts",
  "drive_files",
  "op_reports",
  "op_report_items",
  "op_recurring_themes",
  "hr_emails",
]);

interface TranslateFieldOpts {
  supabase: SupabaseClient;
  table: string;
  id: string;
  field: string;
  sourceText: string;
  targetLocale: FieldLocale;
}

/**
 * Returns the field translated into targetLocale, reading from and writing
 * to the row's translations jsonb cache. Idempotent — concurrent callers
 * for the same field both end up reading the same translation on the next view.
 */
export async function translateField(
  opts: TranslateFieldOpts,
): Promise<{ translated: string; cached: boolean }> {
  const { supabase, table, id, field, sourceText, targetLocale } = opts;

  if (!TRANSLATABLE_TABLES.has(table)) {
    throw new Error(`translateField: table not whitelisted: ${table}`);
  }
  if (!sourceText || sourceText.trim().length < 2) {
    return { translated: sourceText, cached: false };
  }

  const { data: row } = await supabase
    .from(table)
    .select("translations, original_language, gen_locale")
    .eq("id", id)
    .maybeSingle();

  const sourceLocale = row?.original_language ?? row?.gen_locale ?? null;
  if (sourceLocale === targetLocale) {
    return { translated: sourceText, cached: true };
  }

  const existing = row?.translations?.[targetLocale]?.[field];
  if (typeof existing === "string" && existing.length > 0) {
    return { translated: existing, cached: true };
  }

  const translated = await translateText(sourceText, targetLocale);

  const nextTranslations = {
    ...(row?.translations ?? {}),
    [targetLocale]: {
      ...((row?.translations ?? {})[targetLocale] ?? {}),
      [field]: translated,
    },
  };

  await supabase
    .from(table)
    .update({ translations: nextTranslations })
    .eq("id", id);

  return { translated, cached: false };
}

/**
 * Invalidates cached translations for a field — call this from any mutation
 * that updates the source column so stale translations don't linger.
 */
export async function invalidateFieldTranslations(
  supabase: SupabaseClient,
  table: string,
  id: string,
  field: string,
): Promise<void> {
  if (!TRANSLATABLE_TABLES.has(table)) return;

  const { data: row } = await supabase
    .from(table)
    .select("translations")
    .eq("id", id)
    .maybeSingle();

  if (!row?.translations) return;

  const next: Record<string, Record<string, string>> = {};
  for (const [locale, fields] of Object.entries(row.translations as Record<string, Record<string, string>>)) {
    if (!fields) continue;
    const rest: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k !== field) rest[k] = v;
    }
    if (Object.keys(rest).length > 0) next[locale] = rest;
  }

  await supabase.from(table).update({ translations: next }).eq("id", id);
}
