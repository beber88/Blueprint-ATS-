import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET - get a specific search with full results
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireApiAuth({});
    if (authError) return authError;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_searches")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE - delete a search
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireApiAuth({});
    if (authError) return authError;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ai_searches")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
