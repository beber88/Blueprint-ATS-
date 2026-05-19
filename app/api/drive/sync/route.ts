import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyByPath } from "@/lib/drive/classifier";
import { matchEmployeeByName, matchProjectByName } from "@/lib/operations/match-employee";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROOT_FOLDER_ID = "13toVmbWzEvOUhNIR8o8kUH-HLw9TjNJZ";

/**
 * POST /api/drive/sync — Trigger a Drive sync.
 *
 * This route uses the Google Drive MCP tools indirectly.
 * Since MCP tools are only available in Claude conversations,
 * this endpoint reads pre-synced data from drive_files and
 * classifies/routes unprocessed files.
 *
 * For the initial population, files are inserted into drive_files
 * via the /api/drive/ingest endpoint or the MCP sync cron.
 */
export async function POST() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();

  // Process any pending files that haven't been classified yet
  const { data: pending, error } = await supabase
    .from("drive_files")
    .select("*")
    .in("classification_status", ["pending", "classified"])
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending files to process", stats: { processed: 0 } });
  }

  let routed = 0;
  let errors = 0;

  for (const file of pending) {
    const fullPath = file.parent_folder_path
      ? `${file.parent_folder_path}/${file.name}`
      : file.name;

    const classification = classifyByPath(fullPath);

    if (classification.skip) {
      await supabase.from("drive_files")
        .update({ classification_status: "skipped", classification: classification as unknown as Record<string, unknown> })
        .eq("id", file.id);
      continue;
    }

    // Match employee
    let employeeId = file.target_employee_id;
    if (!employeeId && classification.needs_employee_match) {
      const parts = fullPath.split("/");
      // Admin/Employee/{dept}/{name}
      if (parts[0]?.toLowerCase() === "admin" && parts[1]?.toLowerCase() === "employee" && parts.length >= 4) {
        const match = await matchEmployeeByName(supabase, parts[3]);
        employeeId = match.employee_id;
      }
    }

    // Match project
    let projectId: string | null = null;
    if (classification.needs_project_match) {
      const parts = fullPath.split("/");
      if (parts[0]?.toLowerCase() === "projects" && parts.length >= 2) {
        projectId = await matchProjectByName(supabase, parts[1]);
      }
    }

    // Route to target table
    let targetId: string | null = null;
    if (classification.target_table === "hr_employee_documents") {
      const { data } = await supabase.from("hr_employee_documents").insert({
        employee_id: employeeId,
        document_type: classification.document_type || "other",
        title: file.name,
        storage_path: `drive://${file.drive_file_id}`,
        drive_file_id: file.drive_file_id,
        notes: `Synced from Drive: ${fullPath}`,
      }).select("id").single();
      targetId = data?.id || null;
    }

    if (targetId) {
      await supabase.from("drive_files").update({
        classification_status: "routed",
        target_table: classification.target_table,
        target_id: targetId,
        target_employee_id: employeeId,
        document_type: classification.document_type,
        classification: { ...classification, full_path: fullPath } as unknown as Record<string, unknown>,
        imported_at: new Date().toISOString(),
      }).eq("id", file.id);
      routed++;
    } else {
      await supabase.from("drive_files").update({
        classification_status: classification.target_table ? "error" : "needs_review",
        target_table: classification.target_table,
        document_type: classification.document_type,
        classification: { ...classification, full_path: fullPath } as unknown as Record<string, unknown>,
      }).eq("id", file.id);
      errors++;
    }
  }

  // Update sync state
  await supabase.from("drive_sync_state")
    .update({
      status: "completed",
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("root_folder_id", ROOT_FOLDER_ID);

  return NextResponse.json({
    stats: { processed: pending.length, routed, errors },
  });
}
