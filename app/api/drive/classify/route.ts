import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyDriveFileByMetadata,
  classifyDriveFileByContent,
} from "@/lib/drive/classifier";
import { getDriveClient } from "@/lib/drive/client";
import { downloadDriveContent } from "@/lib/drive/download";
import type { drive_v3 } from "googleapis";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH_LIMIT = 10;

/**
 * POST /api/drive/classify
 * Body: { syncStateId?: string, limit?: number, mode?: "content" | "metadata" }
 *
 * Picks up to `limit` drive_files in classification_status='pending'
 * and classifies each. In the default "content" mode the file bytes
 * are downloaded and read by the model (PDF/OCR); if the content can't
 * be fetched the file falls back to metadata-only classification.
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
    const mode: string = body.mode === "metadata" ? "metadata" : "content";

    const admin = createAdminClient();
    let query = admin
      .from("drive_files")
      .select("id, drive_file_id, name, mime_type, parent_folder_path")
      .eq("classification_status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (syncStateId) query = query.eq("sync_state_id", syncStateId);

    const { data: pending, error } = await query;
    if (error) {
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }
    if (!pending || pending.length === 0) {
      return NextResponse.json({ classified: 0, remaining: 0 });
    }

    // Resolve a Drive client once; if unavailable we silently degrade to
    // metadata-only classification for the whole batch.
    let drive: drive_v3.Drive | null = null;
    if (mode === "content") {
      try {
        drive = await getDriveClient(user.id);
      } catch (err) {
        console.warn("Drive client unavailable, classifying by metadata:", err);
      }
    }

    let classified = 0;
    let failed = 0;
    let byContent = 0;

    for (const file of pending) {
      try {
        let result;
        let usedContent = false;

        if (drive) {
          try {
            const content = await downloadDriveContent(
              drive,
              file.drive_file_id,
              file.mime_type,
              null
            );
            if (content.kind !== "unsupported") {
              result = await classifyDriveFileByContent({
                fileName: file.name || "(unnamed)",
                parentFolderPath: file.parent_folder_path,
                mimeType: file.mime_type,
                content,
              });
              usedContent = true;
            }
          } catch (contentErr) {
            console.warn("content classify failed, falling back:", file.id, contentErr);
          }
        }

        if (!result) {
          result = await classifyDriveFileByMetadata({
            fileName: file.name || "(unnamed)",
            parentFolderPath: file.parent_folder_path,
            mimeType: file.mime_type,
          });
        }

        await admin
          .from("drive_files")
          .update({
            classification: { ...result, method: usedContent ? "content" : "metadata" },
            classification_status: "classified",
            document_type: result.document_type,
            original_language: result.language,
            updated_at: new Date().toISOString(),
          })
          .eq("id", file.id);

        classified++;
        if (usedContent) byContent++;
      } catch (err) {
        console.error("classify failed for", file.id, err);
        await admin
          .from("drive_files")
          .update({
            classification_status: "failed",
            error_log: [
              {
                at: new Date().toISOString(),
                message: err instanceof Error ? err.message : String(err),
              },
            ],
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

    return NextResponse.json({
      classified,
      failed,
      by_content: byContent,
      by_metadata: classified - byContent,
      remaining: remaining || 0,
    });
  } catch (err) {
    console.error("classify route error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
