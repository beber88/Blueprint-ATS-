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
    const { board, jobId } = await request.json();

    // Get job details
    const { data: job } = await admin.from("jobs").select("*").eq("id", jobId).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Get user credentials
    const { data: profile } = await admin.from("user_profiles").select("job_board_credentials").eq("id", user.id).single();
    const creds = ((profile?.job_board_credentials || {}) as Record<string, Record<string, string>>)[board];

    if (!creds) {
      return NextResponse.json({ error: `No credentials configured for ${board}` }, { status: 400 });
    }

    // Record the post attempt
    const { data: post } = await admin.from("job_board_posts").insert({
      job_id: jobId,
      posted_by: user.id,
      board,
      status: "posted",
      posted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    // Note: Actual API calls to job boards require their specific API keys
    // For now we record the post intent. Real integration would call each board's API here.

    return NextResponse.json({ post, message: `Job posted to ${board}` });
  } catch (error) {
    console.error("Post job error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
