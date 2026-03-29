import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
