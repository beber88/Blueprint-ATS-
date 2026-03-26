import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  } else {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
