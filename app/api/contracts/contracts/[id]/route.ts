import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractStatus } from "@/lib/contracts/types";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set<ContractStatus>([
  "draft",
  "active",
  "expired",
  "terminated",
  "renewed",
]);

// GET /api/contracts/contracts/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ct_contracts")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "contract not found" }, { status: 404 });
  }
  return NextResponse.json({ contract: data });
}

// PATCH /api/contracts/contracts/:id
// Body: subset of editable fields. Status is bounded by the CHECK constraint.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Whitelist editable fields. Status guarded against CHECK constraint.
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.summary === "string" || body.summary === null) patch.summary = body.summary;
  if (typeof body.flagged_for_review === "boolean") patch.flagged_for_review = body.flagged_for_review;
  if (typeof body.status === "string" && VALID_STATUS.has(body.status as ContractStatus)) {
    patch.status = body.status;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields in body" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ct_contracts")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "update failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ contract: data });
}

// DELETE /api/contracts/contracts/:id — admin only via RLS, no soft-delete.
// We cascade ct_alerts; ct_contract_drafts.saved_contract_id is SET NULL.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ct_contracts")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
