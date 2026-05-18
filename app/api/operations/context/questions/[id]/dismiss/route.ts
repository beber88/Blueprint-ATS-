import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("op_context_questions")
    .update({ status: "dismissed", answered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
