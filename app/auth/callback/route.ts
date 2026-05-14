import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const adminSupabase = createAdminClient();
      await adminSupabase.from("user_profiles").upsert({
        id: user.id,
        email: user.email ?? "",
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
        avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }
  } else {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  return NextResponse.redirect(new URL("/hr/recruitment/dashboard", request.url));
}
