import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ minimumRole: "admin" });
    if (authError) return authError;

    const admin = createAdminClient();

    const { email, full_name, role } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name || "", role: role || "recruiter" },
    });

    if (error) {
      console.error("Invite error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
