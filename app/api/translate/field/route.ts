import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  translateField,
  TRANSLATABLE_TABLES,
  type FieldLocale,
} from "@/lib/i18n/translate-field";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SUPPORTED: FieldLocale[] = ["he", "en", "tl"];

/**
 * POST /api/translate/field
 * Body: { table, id, field, source_text, target_locale }
 *
 * Translates a single row.field into target_locale, reading from and
 * writing to that row's translations jsonb cache. Subsequent views in
 * the same locale are served from cache without re-calling Claude.
 *
 * This is the storage-backed sibling of /api/translate/text — used by
 * the LocalizedText component to make every DB-stored free-text field
 * follow the viewer's locale automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const table: string = body.table;
    const id: string = body.id;
    const field: string = body.field;
    const sourceText: string = (body.source_text ?? "").trim();
    const targetLocale: string = body.target_locale;

    if (!table || !id || !field || !sourceText) {
      return NextResponse.json(
        { error: "table, id, field and source_text are required" },
        { status: 400 },
      );
    }
    if (!SUPPORTED.includes(targetLocale as FieldLocale)) {
      return NextResponse.json(
        { error: "unsupported target_locale" },
        { status: 400 },
      );
    }
    if (!TRANSLATABLE_TABLES.has(table)) {
      return NextResponse.json(
        { error: "table not whitelisted for translation" },
        { status: 400 },
      );
    }
    if (sourceText.length > 8000) {
      return NextResponse.json(
        { error: "source_text too long (max 8000 chars)" },
        { status: 400 },
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Translation is not configured" },
        { status: 503 },
      );
    }

    const supabase = createAdminClient();
    const result = await translateField({
      supabase,
      table,
      id,
      field,
      sourceText,
      targetLocale: targetLocale as FieldLocale,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Field translate error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
