import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriveClient, DriveNotConnectedError, DriveNotConfiguredError } from "@/lib/drive/client";

export const dynamic = "force-dynamic";

const FOLDER_URL_RX =
  /https?:\/\/drive\.google\.com\/drive\/(?:[^?#]*?\/)?folders\/([a-zA-Z0-9_-]+)/;

function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(FOLDER_URL_RX);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const folderInput: string = body.folder_url || body.folder_id || "";
    const folderId = extractFolderId(folderInput);

    if (!folderId) {
      return NextResponse.json(
        { error: "invalid_folder", message: "Provide a Google Drive folder URL or folder ID" },
        { status: 400 }
      );
    }

    let folderName: string | null = null;
    try {
      const drive = await getDriveClient(user.id);
      const meta = await drive.files.get({
        fileId: folderId,
        fields: "id, name, mimeType",
      });
      if (meta.data.mimeType !== "application/vnd.google-apps.folder") {
        return NextResponse.json(
          { error: "not_folder", message: "The provided ID is not a Drive folder" },
          { status: 400 }
        );
      }
      folderName = meta.data.name || null;
    } catch (err) {
      if (err instanceof DriveNotConnectedError) {
        return NextResponse.json({ error: "not_connected" }, { status: 400 });
      }
      if (err instanceof DriveNotConfiguredError) {
        return NextResponse.json({ error: "not_configured" }, { status: 503 });
      }
      console.error("folder metadata fetch failed:", err);
      return NextResponse.json({ error: "folder_unreachable" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("drive_sync_state")
      .insert({
        user_id: user.id,
        root_folder_id: folderId,
        root_folder_name: folderName,
        status: "running",
        started_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
        cursor: {},
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create sync_state:", error);
      return NextResponse.json({ error: "Failed to start sync" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("drive sync start error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
