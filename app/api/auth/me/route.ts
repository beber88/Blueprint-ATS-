import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // Auto-create profile if missing
      const { data: newProfile } = await admin.from("user_profiles").insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
        role: "user",
      }).select().single();
      return NextResponse.json(newProfile);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json(null, { status: 500 });
  }
}
