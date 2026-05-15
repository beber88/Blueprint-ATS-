import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractContract } from "@/lib/contracts/extract-contract";
import { computeContractWarnings } from "@/lib/contracts/draft-warnings";
import { loadContractSnapshot } from "@/lib/contracts/draft-master-snapshot";
import { requireApiAuth } from "@/lib/api/auth";

// Match the require pattern used by /api/cv/upload — pdf-parse has a
// top-level side effect on its index that breaks Next's bundler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  b: Buffer
) => Promise<{ text: string }>;

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/contracts/intake/extract
//
// Accepts either:
//   - application/json: { text }
//   - multipart/form-data: file (PDF) and/or text
//
// Runs Claude metadata extraction and persists the result as a DRAFT
// (ct_contract_drafts). The Preview UI then GETs the draft, lets the
// operator edit, and posts to /save when ready.

async function parseInputs(request: NextRequest): Promise<
  { text: string } | { error: string; status: number }
> {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as { text?: string };
      return { text: body.text || "" };
    } catch {
      return { error: "invalid JSON body", status: 400 };
    }
  }
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const fileField = form.get("file");
    let text = (form.get("text") as string | null) || "";
    if (fileField && fileField instanceof File && fileField.size > 0) {
      const buffer = Buffer.from(await fileField.arrayBuffer());
      try {
        const out = await pdfParse(buffer);
        text = (text + "\n" + out.text).trim();
      } catch (e) {
        return {
          error: `pdf-parse failed: ${e instanceof Error ? e.message : String(e)}`,
          status: 422,
        };
      }
    }
    return { text };
  }
  return { error: `unsupported content-type: ${ct}`, status: 415 };
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const parsed = await parseInputs(request);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (!parsed.text || parsed.text.trim().length < 50) {
    return NextResponse.json(
      { error: "text required (min 50 chars; PDF must produce text)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  let aiOutput;
  try {
    aiOutput = await extractContract(parsed.text);
  } catch (e) {
    return NextResponse.json(
      { error: `extraction failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  const snapshot = await loadContractSnapshot(supabase);
  const warnings = computeContractWarnings(aiOutput, snapshot);

  const { data: draft, error } = await supabase
    .from("ct_contract_drafts")
    .insert({
      source_text: parsed.text.slice(0, 200_000),
      ai_output_json: aiOutput,
      warnings_json: warnings,
      source_kind: "manual",
      status: "draft",
    })
    .select()
    .single();

  if (error || !draft) {
    return NextResponse.json(
      { error: `failed to create draft: ${error?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    draftId: draft.id,
    warnings,
    ai_output: aiOutput,
  });
}
