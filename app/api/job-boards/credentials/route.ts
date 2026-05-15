import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireApiAuth({ module: "recruitment" });
    if (error) return error;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("job_board_credentials").eq("id", user!.id).single();

    // Mask sensitive values
    const creds = (profile?.job_board_credentials || {}) as Record<string, Record<string, string>>;
    const masked: Record<string, Record<string, string>> = {};
    for (const [board, fields] of Object.entries(creds)) {
      masked[board] = {};
      for (const [key, val] of Object.entries(fields)) {
        masked[board][key] = val ? "••••" + val.slice(-4) : "";
      }
    }

    return NextResponse.json(masked);
  } catch (error) {
    console.error("Credentials error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireApiAuth({ module: "recruitment" });
    if (error) return error;

    const body = await request.json();
    const { board, credentials } = body;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("job_board_credentials").eq("id", user!.id).single();
    const existing = (profile?.job_board_credentials || {}) as Record<string, unknown>;

    existing[board] = credentials;

    await admin.from("user_profiles").update({ job_board_credentials: existing }).eq("id", user!.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save credentials error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
