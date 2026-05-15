import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractContractFields } from "@/lib/contracts/extract";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/contracts/draft
 * Body: { source_text: string, source_kind?: "paste" | "upload" }
 *
 * Runs the Claude extractor on the pasted text, persists a ct_contract_drafts
 * row, and returns the structured fields so the UI can pre-fill the
 * contract create form.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    const sourceText: string = (body.source_text || "").trim();
    const sourceKind: string = body.source_kind || "paste";

    if (sourceText.length < 50) {
      return NextResponse.json(
        { error: "source_text_too_short", message: "Provide at least 50 characters of contract text" },
        { status: 400 }
      );
    }

    const extracted = await extractContractFields(sourceText);

    const admin = createAdminClient();
    const { data: draft, error: draftErr } = await admin
      .from("ct_contract_drafts")
      .insert({
        source_text: sourceText,
        source_kind: sourceKind,
        ai_output_json: extracted,
        warnings_json: extracted.warnings,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (draftErr) {
      console.error("Failed to persist contract draft:", draftErr);
      return NextResponse.json({ error: "persist_failed" }, { status: 500 });
    }

    return NextResponse.json({ draft, extracted });
  } catch (err) {
    console.error("contracts draft error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
