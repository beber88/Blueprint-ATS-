import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const LANG_NAMES: Record<string, string> = {
  he: "Hebrew",
  en: "English",
  tl: "Tagalog",
};

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "operations" });
    if (authError) return authError;

    const { itemIds, targetLang } = await request.json();

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds array is required" }, { status: 400 });
    }
    if (!targetLang || !["he", "en", "tl"].includes(targetLang)) {
      return NextResponse.json({ error: "targetLang must be 'he', 'en', or 'tl'" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch all requested items
    const { data: items, error: fetchError } = await supabase
      .from("op_report_items")
      .select("id, issue, next_action, missing_information, translations")
      .in("id", itemIds);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items found" }, { status: 404 });
    }

    const translations: Record<string, { issue: string; next_action: string | null; missing_information: string | null }> = {};
    const uncachedItems: typeof items = [];

    // Check cache for each item
    for (const item of items) {
      const cached = item.translations?.[targetLang];
      if (cached) {
        translations[item.id] = cached;
      } else {
        uncachedItems.push(item);
      }
    }

    // Batch translate uncached items in a single Claude call
    if (uncachedItems.length > 0) {
      const toTranslate: Record<string, { issue: string; next_action: string | null; missing_information: string | null }> = {};
      for (const item of uncachedItems) {
        toTranslate[item.id] = {
          issue: item.issue,
          next_action: item.next_action,
          missing_information: item.missing_information,
        };
      }

      const anthropic = new Anthropic();
      const langName = LANG_NAMES[targetLang] || targetLang;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `You are a translator. Translate the following JSON object values to ${langName}. Keep proper nouns (names, project names) unchanged. Return ONLY the translated JSON.`,
        messages: [
          {
            role: "user",
            content: JSON.stringify(toTranslate),
          },
        ],
      });

      // Extract text from response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "Translation returned no text" }, { status: 500 });
      }

      let translated: Record<string, { issue: string; next_action: string | null; missing_information: string | null }>;
      try {
        // Strip markdown code fences if present
        let raw = textBlock.text.trim();
        if (raw.startsWith("```")) {
          raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        translated = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: "Failed to parse translation response" }, { status: 500 });
      }

      // Save translations to cache and collect results
      for (const item of uncachedItems) {
        const itemTranslation = translated[item.id];
        if (itemTranslation) {
          translations[item.id] = itemTranslation;

          // Merge with existing translations
          const existingTranslations = item.translations || {};
          const merged = { ...existingTranslations, [targetLang]: itemTranslation };

          await supabase
            .from("op_report_items")
            .update({ translations: merged })
            .eq("id", item.id);
        }
      }
    }

    return NextResponse.json({ translations });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
