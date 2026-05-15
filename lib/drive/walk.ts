import { drive_v3 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface WalkProgress {
  files_seen: number;
  files_imported: number;
  files_skipped: number;
  files_duplicate: number;
  files_errored: number;
}

const FILE_FIELDS =
  "id, name, mimeType, size, md5Checksum, modifiedTime, parents";

/**
 * Walk a Drive folder recursively. Each tick processes up to `limit` files
 * (across the whole walk) and persists `drive_files` rows for everything
 * it sees. Designed to be called repeatedly (cron / edge tick) until the
 * sync_state row reaches `complete`.
 */
export async function walkFolder(
  drive: drive_v3.Drive,
  syncStateId: string,
  rootFolderId: string,
  limit = 20
): Promise<WalkProgress> {
  const supabase = createAdminClient();
  const progress: WalkProgress = {
    files_seen: 0,
    files_imported: 0,
    files_skipped: 0,
    files_duplicate: 0,
    files_errored: 0,
  };

  // Resume from cursor if present
  const { data: state } = await supabase
    .from("drive_sync_state")
    .select("cursor")
    .eq("id", syncStateId)
    .single();

  const cursor: { stack?: string[]; visited?: string[]; pageToken?: string } =
    (state?.cursor as Record<string, unknown> | null) || {};
  const stack: string[] = cursor.stack && cursor.stack.length > 0 ? cursor.stack : [rootFolderId];
  const visited: Set<string> = new Set(cursor.visited || []);
  let pageToken: string | undefined = cursor.pageToken;

  while (stack.length > 0 && progress.files_seen < limit) {
    const folderId = stack[stack.length - 1];
    if (visited.has(folderId) && !pageToken) {
      stack.pop();
      continue;
    }

    let resp;
    try {
      resp = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: `nextPageToken, files(${FILE_FIELDS})`,
        pageSize: Math.min(100, limit - progress.files_seen),
        pageToken,
      });
    } catch (err) {
      console.error("Drive list error for folder", folderId, err);
      progress.files_errored++;
      stack.pop();
      visited.add(folderId);
      pageToken = undefined;
      continue;
    }

    const files = resp.data.files || [];

    for (const f of files) {
      if (!f.id) continue;
      progress.files_seen++;

      if (f.mimeType === FOLDER_MIME) {
        if (!visited.has(f.id) && !stack.includes(f.id)) {
          stack.push(f.id);
        }
        progress.files_skipped++;
        continue;
      }

      try {
        const inserted = await upsertDriveFile(supabase, syncStateId, f);
        if (inserted === "duplicate") progress.files_duplicate++;
        else if (inserted === "new" || inserted === "updated") progress.files_imported++;
      } catch (err) {
        console.error("Failed to upsert drive_file", f.id, err);
        progress.files_errored++;
      }

      if (progress.files_seen >= limit) break;
    }

    pageToken = resp.data.nextPageToken || undefined;
    if (!pageToken) {
      visited.add(folderId);
      stack.pop();
    }
  }

  await supabase
    .from("drive_sync_state")
    .update({
      cursor: { stack, visited: Array.from(visited), pageToken },
      files_seen: (state?.cursor as { files_seen?: number })?.files_seen
        ? undefined
        : undefined,
      last_progress_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", syncStateId);

  return progress;
}

type UpsertResult = "new" | "updated" | "duplicate";

async function upsertDriveFile(
  supabase: ReturnType<typeof createAdminClient>,
  syncStateId: string,
  file: drive_v3.Schema$File
): Promise<UpsertResult> {
  if (!file.id) throw new Error("file.id missing");

  if (file.md5Checksum) {
    const { data: existing } = await supabase
      .from("drive_files")
      .select("id")
      .eq("md5_checksum", file.md5Checksum)
      .neq("drive_file_id", file.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("drive_files")
        .upsert(
          {
            drive_file_id: file.id,
            sync_state_id: syncStateId,
            name: file.name,
            mime_type: file.mimeType,
            size_bytes: file.size ? Number(file.size) : null,
            modified_time: file.modifiedTime,
            md5_checksum: file.md5Checksum,
            file_hash: file.md5Checksum,
            classification_status: "duplicate",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "drive_file_id" }
        );
      return "duplicate";
    }
  }

  const { data: existingSelf } = await supabase
    .from("drive_files")
    .select("id")
    .eq("drive_file_id", file.id)
    .maybeSingle();

  await supabase.from("drive_files").upsert(
    {
      drive_file_id: file.id,
      sync_state_id: syncStateId,
      name: file.name,
      mime_type: file.mimeType,
      size_bytes: file.size ? Number(file.size) : null,
      modified_time: file.modifiedTime,
      md5_checksum: file.md5Checksum,
      file_hash: file.md5Checksum,
      parent_folder_id: (file.parents && file.parents[0]) || null,
      classification_status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "drive_file_id" }
  );

  return existingSelf ? "updated" : "new";
}
