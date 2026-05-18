import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const draftId = url.searchParams.get("draft_id");
  const status = url.searchParams.get("status");

  let query = supabase
    .from("op_context_questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (draftId) query = query.eq("draft_id", draftId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data || [] });
}
