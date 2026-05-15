import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  persistTokens,
  DriveNotConfiguredError,
} from "@/lib/drive/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateUserId = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const settingsUrl = new URL("/settings/integrations", request.url);

  if (errorParam) {
    settingsUrl.searchParams.set("drive_error", errorParam);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("drive_error", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      settingsUrl.searchParams.set("drive_error", "unauthenticated");
      return NextResponse.redirect(settingsUrl);
    }

    if (stateUserId && stateUserId !== user.id) {
      settingsUrl.searchParams.set("drive_error", "state_mismatch");
      return NextResponse.redirect(settingsUrl);
    }

    const { tokens, email } = await exchangeCodeForTokens(code);
    await persistTokens(user.id, tokens, email);

    settingsUrl.searchParams.set("drive_connected", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    if (err instanceof DriveNotConfiguredError) {
      settingsUrl.searchParams.set("drive_error", "not_configured");
      return NextResponse.redirect(settingsUrl);
    }
    console.error("drive callback error:", err);
    settingsUrl.searchParams.set("drive_error", "exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
