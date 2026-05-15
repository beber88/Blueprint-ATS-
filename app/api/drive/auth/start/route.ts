import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl, DriveNotConfiguredError } from "@/lib/drive/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const url = buildAuthUrl(user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof DriveNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("drive auth start error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
