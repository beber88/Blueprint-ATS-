import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SUPPORTED = ["en", "he", "tl"];

/**
 * POST /api/translate/text
 * Body: { text: string, target_language: "en" | "he" | "tl" }
 *
 * Translates a single block of plain text between the app's three
 * languages. Powers the inline TranslateButton so HR staff can read
 * contract summaries, document titles and notes in their own language
 * regardless of the source language.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text: string = (body.text || "").trim();
    const target: string = body.target_language;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (!SUPPORTED.includes(target)) {
      return NextResponse.json({ error: "unsupported target_language" }, { status: 400 });
    }
    if (text.length > 8000) {
      return NextResponse.json({ error: "text too long (max 8000 chars)" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Translation is not configured" }, { status: 503 });
    }

    const translated = await translateText(text, target);
    return NextResponse.json({ translated, target_language: target });
  } catch (err) {
    console.error("Text translate error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
