import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false, reason: "unauthenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("drive_oauth_tokens")
    .select("google_email, scope, expiry_date, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    google_email: data.google_email,
    scope: data.scope,
    expiry_date: data.expiry_date,
    last_refreshed_at: data.updated_at,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin.from("drive_oauth_tokens").delete().eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
