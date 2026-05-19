/**
 * Drive Sync Service — orchestrates the sync pipeline.
 *
 * Uses Google Drive MCP (via API proxy) to:
 * 1. Walk all folders recursively from the root
 * 2. Store file metadata in drive_files
 * 3. Classify each file by folder path
 * 4. Route classified files to target HR tables
 *
 * Deduplication: skips files already in drive_files (by drive_file_id).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { classifyByPath } from "@/lib/drive/classifier";
import { matchEmployeeByName } from "@/lib/operations/match-employee";
import { matchProjectByName } from "@/lib/operations/match-employee";

const ROOT_FOLDER_ID = "13toVmbWzEvOUhNIR8o8kUH-HLw9TjNJZ";

interface DriveFile {
  id: string;
  title: string;
  mimeType: string;
  fileSize?: string;
  md5Checksum?: string;
  parentId?: string;
  createdTime?: string;
  modifiedTime?: string;
  viewUrl?: string;
}

interface WalkResult {
  files: DriveFile[];
  path: string;
}

export interface SyncStats {
  files_seen: number;
  files_new: number;
  files_classified: number;
  files_routed: number;
  files_skipped: number;
  files_error: number;
}

/**
 * Run a full sync: walk Drive → store metadata → classify → route.
 * Returns stats about the sync run.
 */
export async function runDriveSync(
  walkFn: (folderId: string, path: string) => Promise<WalkResult[]>
): Promise<SyncStats> {
  const supabase = createAdminClient();
  const stats: SyncStats = {
    files_seen: 0, files_new: 0, files_classified: 0,
    files_routed: 0, files_skipped: 0, files_error: 0,
  };

  // Update sync state to running
  await upsertSyncState(supabase, "running");

  try {
    // Walk all folders recursively
    const allFiles = await walkFn(ROOT_FOLDER_ID, "");

    for (const batch of allFiles) {
      for (const file of batch.files) {
        stats.files_seen++;

        // Skip folders
        if (file.mimeType === "application/vnd.google-apps.folder") continue;

        // Dedup check
        const { data: existing } = await supabase
          .from("drive_files")
          .select("id")
          .eq("drive_file_id", file.id)
          .maybeSingle();

        if (existing) continue;
        stats.files_new++;

        // Build full path
        const fullPath = batch.path ? `${batch.path}/${file.title}` : file.title;

        // Classify
        const classification = classifyByPath(fullPath);

        if (classification.skip) {
          stats.files_skipped++;
          // Still store for tracking
          await supabase.from("drive_files").insert({
            drive_file_id: file.id,
            parent_folder_id: file.parentId || null,
            parent_folder_path: batch.path || null,
            name: file.title,
            mime_type: file.mimeType,
            size_bytes: file.fileSize ? parseInt(file.fileSize) : null,
            md5_checksum: file.md5Checksum || null,
            classification_status: "skipped",
            classification: classification as unknown as Record<string, unknown>,
            modified_time: file.modifiedTime || null,
          }).then(() => {}, () => {});
          continue;
        }

        stats.files_classified++;

        // Match employee if needed
        let employeeId: string | null = null;
        if (classification.needs_employee_match) {
          // Try to extract employee name from path
          const employeeName = extractEmployeeName(fullPath);
          if (employeeName) {
            const match = await matchEmployeeByName(supabase, employeeName);
            employeeId = match.employee_id;
          }
        }

        // Match project if needed
        let projectId: string | null = null;
        if (classification.needs_project_match) {
          const projectName = extractProjectName(fullPath);
          if (projectName) {
            projectId = await matchProjectByName(supabase, projectName);
          }
        }

        // Insert into drive_files
        const { data: driveFile, error: insertErr } = await supabase
          .from("drive_files")
          .insert({
            drive_file_id: file.id,
            parent_folder_id: file.parentId || null,
            parent_folder_path: batch.path || null,
            name: file.title,
            mime_type: file.mimeType,
            size_bytes: file.fileSize ? parseInt(file.fileSize) : null,
            md5_checksum: file.md5Checksum || null,
            classification_status: "classified",
            target_table: classification.target_table,
            document_type: classification.document_type,
            target_employee_id: employeeId,
            classification: {
              ...classification,
              full_path: fullPath,
            } as unknown as Record<string, unknown>,
            modified_time: file.modifiedTime || null,
          })
          .select("id")
          .single();

        if (insertErr || !driveFile) {
          stats.files_error++;
          continue;
        }

        // Route to target table
        if (classification.target_table && classification.target_table !== "candidates" && classification.target_table !== "op_reports") {
          try {
            const targetId = await routeToTable(
              supabase, classification.target_table, classification.document_type,
              file, employeeId, projectId, fullPath
            );
            if (targetId) {
              await supabase.from("drive_files").update({
                classification_status: "routed",
                target_id: targetId,
                imported_at: new Date().toISOString(),
              }).eq("id", driveFile.id);
              stats.files_routed++;
            }
          } catch {
            stats.files_error++;
            await supabase.from("drive_files").update({
              classification_status: "error",
              error_log: [{ error: "routing failed", timestamp: new Date().toISOString() }],
            }).eq("id", driveFile.id);
          }
        }
      }
    }

    await upsertSyncState(supabase, "completed", stats);
  } catch (err) {
    await upsertSyncState(supabase, "failed", stats, err instanceof Error ? err.message : String(err));
    throw err;
  }

  return stats;
}

/** Route a classified file into its target HR table */
async function routeToTable(
  supabase: ReturnType<typeof createAdminClient>,
  targetTable: string,
  documentType: string | null,
  file: DriveFile,
  employeeId: string | null,
  _projectId: string | null,
  fullPath: string,
): Promise<string | null> {
  if (targetTable === "hr_employee_documents") {
    const { data } = await supabase
      .from("hr_employee_documents")
      .insert({
        employee_id: employeeId,
        document_type: documentType || "other",
        title: file.title,
        storage_path: `drive://${file.id}`,
        drive_file_id: file.id,
        notes: `Synced from Drive: ${fullPath}`,
      })
      .select("id")
      .single();
    return data?.id || null;
  }

  if (targetTable === "hr_payslips") {
    const { data } = await supabase
      .from("hr_payslips")
      .insert({
        employee_id: employeeId,
        period_start: extractDateFromName(file.title, "start"),
        period_end: extractDateFromName(file.title, "end"),
        status: "final",
        storage_path: `drive://${file.id}`,
        drive_file_id: file.id,
      })
      .select("id")
      .single();
    return data?.id || null;
  }

  if (targetTable === "hr_salary") {
    const { data } = await supabase
      .from("hr_salary")
      .insert({
        employee_id: employeeId,
        effective_date: extractDateFromName(file.title, "start") || new Date().toISOString().slice(0, 10),
        base_salary: 0, // needs manual entry
        currency: "PHP",
        pay_frequency: "semi-monthly",
      })
      .select("id")
      .single();
    return data?.id || null;
  }

  if (targetTable === "hr_performance_reviews") {
    const { data } = await supabase
      .from("hr_performance_reviews")
      .insert({
        employee_id: employeeId,
        reviewer_id: employeeId, // self for now
        review_date: new Date().toISOString().slice(0, 10),
        status: "completed",
      })
      .select("id")
      .single();
    return data?.id || null;
  }

  return null;
}

/** Extract employee name from path like "Admin/Employee/Engineer/Jester/file.pdf" */
function extractEmployeeName(path: string): string | null {
  const parts = path.split("/");
  // Admin/Employee/{dept}/{name} — name is parts[3]
  if (parts[0]?.toLowerCase() === "admin" && parts[1]?.toLowerCase() === "employee" && parts.length >= 4) {
    return parts[3];
  }
  // For other paths, try to extract from filename
  return null;
}

/** Extract project name from path like "Projects/Pearl De Flore SM San Lazaro/file.pdf" */
function extractProjectName(path: string): string | null {
  const parts = path.split("/");
  if (parts[0]?.toLowerCase() === "projects" && parts.length >= 2) {
    return parts[1];
  }
  return null;
}

/** Try to extract a date from a filename (e.g. "Payroll_2026-01-15.pdf") */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function extractDateFromName(name: string, _type: "start" | "end"): string | null {
  const match = name.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  if (match) return match[1].replace(/\//g, "-");

  const monthMatch = name.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*(\d{4})/i);
  if (monthMatch) {
    const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const m = months[monthMatch[1].toLowerCase().slice(0, 3)];
    if (m) return `${monthMatch[2]}-${m}-01`;
  }
  return null;
}

/** Upsert the sync state tracking row */
async function upsertSyncState(
  supabase: ReturnType<typeof createAdminClient>,
  status: string,
  stats?: SyncStats,
  errorMessage?: string,
) {
  const { data: existing } = await supabase
    .from("drive_sync_state")
    .select("id")
    .eq("root_folder_id", ROOT_FOLDER_ID)
    .maybeSingle();

  const updates = {
    root_folder_id: ROOT_FOLDER_ID,
    status,
    last_sync_at: status === "completed" ? new Date().toISOString() : undefined,
    files_seen: stats?.files_seen,
    files_imported: stats?.files_routed,
    files_skipped: stats?.files_skipped,
    files_errored: stats?.files_error,
    error_message: errorMessage || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("drive_sync_state").update(updates).eq("id", existing.id);
  } else {
    await supabase.from("drive_sync_state").insert(updates);
  }
}
