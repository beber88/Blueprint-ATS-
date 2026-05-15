import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDriveClient,
  DriveNotConnectedError,
  DriveNotConfiguredError,
} from "@/lib/drive/client";
import { walkFolder } from "@/lib/drive/walk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TICK_LIMIT = 20;

/**
 * Drives one batch of work for a sync. Idempotent — call repeatedly until
 * the sync_state row reaches `complete` or `error`.
 *
 * Body: { syncStateId: string }
 *
 * Auth: this route is protected by the optional DRIVE_SYNC_TICK_SECRET
 * header so it can be invoked by Vercel Cron / external scheduler.
 */
export async function POST(request: NextRequest) {
  const tickSecret = process.env.DRIVE_SYNC_TICK_SECRET;
  if (tickSecret) {
    const provided = request.headers.get("x-tick-secret");
    if (provided !== tickSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: { syncStateId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { syncStateId } = body;
  if (!syncStateId) {
    return NextResponse.json({ error: "syncStateId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: state, error: stateErr } = await admin
    .from("drive_sync_state")
    .select("*")
    .eq("id", syncStateId)
    .single();

  if (stateErr || !state) {
    return NextResponse.json({ error: "sync_state_not_found" }, { status: 404 });
  }

  if (state.status === "complete" || state.status === "paused") {
    return NextResponse.json({ status: state.status, progress: state });
  }

  try {
    const drive = await getDriveClient(state.user_id);
    const progress = await walkFolder(drive, syncStateId, state.root_folder_id, TICK_LIMIT);

    const newSeen = (state.files_seen || 0) + progress.files_seen;
    const newImported = (state.files_imported || 0) + progress.files_imported;
    const newSkipped = (state.files_skipped || 0) + progress.files_skipped;
    const newDup = (state.files_duplicate || 0) + progress.files_duplicate;
    const newErr = (state.files_errored || 0) + progress.files_errored;

    // Refresh state to get the updated cursor written by walkFolder
    const { data: refreshed } = await admin
      .from("drive_sync_state")
      .select("cursor")
      .eq("id", syncStateId)
      .single();

    const cursor = (refreshed?.cursor as { stack?: string[]; pageToken?: string }) || {};
    const isDone =
      (!cursor.stack || cursor.stack.length === 0) && !cursor.pageToken;

    await admin
      .from("drive_sync_state")
      .update({
        files_seen: newSeen,
        files_imported: newImported,
        files_skipped: newSkipped,
        files_duplicate: newDup,
        files_errored: newErr,
        status: isDone ? "complete" : "running",
        completed_at: isDone ? new Date().toISOString() : null,
        last_progress_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", syncStateId);

    return NextResponse.json({
      status: isDone ? "complete" : "running",
      progress: {
        files_seen: newSeen,
        files_imported: newImported,
        files_skipped: newSkipped,
        files_duplicate: newDup,
        files_errored: newErr,
      },
      tick: progress,
    });
  } catch (err) {
    if (err instanceof DriveNotConnectedError) {
      await admin
        .from("drive_sync_state")
        .update({ status: "error", error_message: "Drive not connected" })
        .eq("id", syncStateId);
      return NextResponse.json({ error: "not_connected" }, { status: 400 });
    }
    if (err instanceof DriveNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    console.error("sync tick error:", err);
    await admin
      .from("drive_sync_state")
      .update({
        status: "error",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", syncStateId);
    return NextResponse.json({ error: "tick_failed" }, { status: 500 });
  }
}
