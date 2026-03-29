import { NextRequest, NextResponse } from "next/server";
import { translateAnalysis } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { data, targetLang } = await request.json();
    if (!data || !targetLang) {
      return NextResponse.json({ error: "data and targetLang required" }, { status: 400 });
    }

    // Don't translate if already in English (source language)
    if (targetLang === "en") {
      return NextResponse.json({ translated: data });
    }

    const translated = await translateAnalysis(data, targetLang);
    return NextResponse.json({ translated });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
