import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error: authError } = await requireApiAuth({ minimumRole: "admin" });
    if (authError) return authError;

    const admin = createAdminClient();

    const { data: users, error } = await admin.from("user_profiles").select("*").order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
