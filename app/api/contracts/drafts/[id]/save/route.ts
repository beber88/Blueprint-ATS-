import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteContract } from "@/lib/contracts/contract-promote";
import { requireApiAuth } from "@/lib/api/auth";
import type { ContractDraftRow, ContractWarning } from "@/lib/contracts/types";

export const dynamic = "force-dynamic";

// POST /api/contracts/drafts/:id/save
// Body: { flagForReview?: boolean, force?: boolean }
//
// Promotes the draft to a ct_contracts row via lib/contracts/contract-promote.
// If any high-severity warning exists and `force` is not true, returns 409
// so the UI can prompt for confirmation.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const body: { flagForReview?: boolean; force?: boolean } = await request
    .json()
    .catch(() => ({}));

  const supabase = createAdminClient();
  const { data: draft, error: fetchErr } = await supabase
    .from("ct_contract_drafts")
    .select("*")
    .eq("id", params.id)
    .single();
  if (fetchErr || !draft) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }
  if (draft.status === "saved" || draft.status === "discarded") {
    return NextResponse.json(
      { error: `draft already ${draft.status}` },
      { status: 409 }
    );
  }

  const warnings = (draft.warnings_json || []) as ContractWarning[];
  const highCount = warnings.filter((w) => w.severity === "high").length;
  if (highCount > 0 && !body.force) {
    return NextResponse.json(
      {
        error: `${highCount} high-severity warning(s) — pass force=true to save anyway`,
        highWarnings: highCount,
      },
      { status: 409 }
    );
  }

  try {
    const result = await promoteContract(supabase, draft as ContractDraftRow, {
      flagForReview: !!body.flagForReview,
    });
    return NextResponse.json({
      contractId: result.contractId,
      category: result.category,
      flagged: !!body.flagForReview,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
