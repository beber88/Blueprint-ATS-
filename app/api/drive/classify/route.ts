import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyDriveFileByMetadata } from "@/lib/drive/classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 10;

/**
 * POST /api/drive/classify
 * Body: { syncStateId?: string, limit?: number }
 *
 * Picks up to `limit` drive_files in classification_status='pending',
 * runs the classifier on each, and persists the structured result.
 * Returns a summary so the UI can show progress.
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

    const admin = createAdminClient();
    let query = admin
      .from("drive_files")
      .select("id, drive_file_id, name, mime_type, parent_folder_path")
      .eq("classification_status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (syncStateId) {
      query = query.eq("sync_state_id", syncStateId);
    }

    const { data: pending, error } = await query;
    if (error) {
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ classified: 0, remaining: 0 });
    }

    let classified = 0;
    let failed = 0;

    for (const file of pending) {
      try {
        const result = await classifyDriveFileByMetadata({
          fileName: file.name || "(unnamed)",
          parentFolderPath: file.parent_folder_path,
          mimeType: file.mime_type,
        });

        await admin
          .from("drive_files")
          .update({
            classification: result,
            classification_status: "classified",
            document_type: result.document_type,
            original_language: result.language,
            updated_at: new Date().toISOString(),
          })
          .eq("id", file.id);

        classified++;
      } catch (err) {
        console.error("classify failed for", file.id, err);
        await admin
          .from("drive_files")
          .update({
            classification_status: "failed",
            error_log: [{ at: new Date().toISOString(), message: err instanceof Error ? err.message : String(err) }],
            updated_at: new Date().toISOString(),
          })
          .eq("id", file.id);
        failed++;
      }
    }

    const { count: remaining } = await admin
      .from("drive_files")
      .select("id", { count: "exact", head: true })
      .eq("classification_status", "pending");

    return NextResponse.json({ classified, failed, remaining: remaining || 0 });
  } catch (err) {
    console.error("classify route error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
