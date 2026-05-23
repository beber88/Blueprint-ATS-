import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { canAccessEmployeeProfile } from "@/lib/hr/access";
import { getEmployeeProfileSummary } from "@/lib/hr/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth({ module: "hr-management" });
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const allowed = await canAccessEmployeeProfile(supabase, auth.profile.id, params.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await getEmployeeProfileSummary(supabase, params.id);
  return NextResponse.json({ summary });
}
