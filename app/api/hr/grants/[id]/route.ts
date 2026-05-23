import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// DELETE = revoke (we keep the row for audit, just stamp revoked_at).
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError, profile } = await requireApiAuth({
    module: "hr-management",
    minimumRole: "admin",
  });
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_profile_grants")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: profile?.id ?? null,
    })
    .eq("id", params.id)
    .is("revoked_at", null)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grant: data });
}
