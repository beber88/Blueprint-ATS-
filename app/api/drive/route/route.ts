import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeDriveFile } from "@/lib/drive/router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 25;

/**
 * POST /api/drive/route
 * Body: { syncStateId?: string, limit?: number, fileId?: string }
 *
 * Routes drive_files in classification_status='classified' into the right
 * HRIS table (hr_employee_documents, hr_payslips, etc) using the
 * lib/drive/router logic.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(BATCH_LIMIT, Math.max(1, Number(body.limit) || BATCH_LIMIT));
    const syncStateId: string | undefined = body.syncStateId;
    const singleFileId: string | undefined = body.fileId;

    const admin = createAdminClient();

    let toRoute: { id: string }[] = [];
    if (singleFileId) {
      toRoute = [{ id: singleFileId }];
    } else {
      let query = admin
        .from("drive_files")
        .select("id")
        .eq("classification_status", "classified")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (syncStateId) query = query.eq("sync_state_id", syncStateId);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
      toRoute = data || [];
    }

    let routed = 0;
    let needsReview = 0;
    let failed = 0;

    for (const f of toRoute) {
      const result = await routeDriveFile(f.id);
      if (result.routed) routed++;
      else if (result.reason === "needs_human_review") needsReview++;
      else failed++;
    }

    return NextResponse.json({ routed, needs_review: needsReview, failed, processed: toRoute.length });
  } catch (err) {
    console.error("route route error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
