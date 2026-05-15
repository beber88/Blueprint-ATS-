import { createAdminClient } from "@/lib/supabase/admin";
import type { HrDocumentClassification } from "./classifier";

export interface RouteResult {
  routed: boolean;
  target_table: string | null;
  target_id: string | null;
  reason?: string;
}

/**
 * Try to find an existing op_employees row matching the classifier's guessed
 * name. Uses simple ilike + trgm. Returns null if no confident match.
 */
async function findEmployeeByName(name: string): Promise<string | null> {
  if (!name || name.length < 3) return null;
  const supabase = createAdminClient();

  const escaped = name.replace(/[%_]/g, (m) => `\\${m}`);
  const { data } = await supabase
    .from("op_employees")
    .select("id, full_name, full_name_en, full_name_he, full_name_tl")
    .or(
      `full_name.ilike.%${escaped}%,full_name_en.ilike.%${escaped}%,full_name_he.ilike.%${escaped}%,full_name_tl.ilike.%${escaped}%`
    )
    .limit(2);

  if (data && data.length === 1) return data[0].id;
  return null;
}

/**
 * Route a single classified drive_files row into the right HRIS table.
 * Idempotent: re-running on a "routed" row is a no-op.
 */
export async function routeDriveFile(driveFileRowId: string): Promise<RouteResult> {
  const supabase = createAdminClient();

  const { data: dfile, error: fetchErr } = await supabase
    .from("drive_files")
    .select("*")
    .eq("id", driveFileRowId)
    .single();

  if (fetchErr || !dfile) {
    return { routed: false, target_table: null, target_id: null, reason: "drive_file_not_found" };
  }

  if (dfile.classification_status === "routed") {
    return { routed: true, target_table: dfile.target_table, target_id: dfile.target_id, reason: "already_routed" };
  }

  const classification: HrDocumentClassification | null = (dfile.classification as HrDocumentClassification) || null;

  if (!classification || classification.target_table_hint === "skip" || classification.confidence < 50) {
    await supabase
      .from("drive_files")
      .update({
        classification_status: "skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", driveFileRowId);
    return { routed: false, target_table: null, target_id: null, reason: "low_confidence_or_skip" };
  }

  let employeeId: string | null = null;
  if (classification.employee_name) {
    employeeId = await findEmployeeByName(classification.employee_name);
  }

  // Default routing target = hr_employee_documents
  const target = classification.target_table_hint;

  if (target === "hr_employee_documents") {
    if (!employeeId) {
      await supabase
        .from("drive_files")
        .update({
          classification_status: "failed",
          target_employee_id: null,
          error_log: appendError(dfile.error_log, "no_matching_employee"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driveFileRowId);
      return { routed: false, target_table: target, target_id: null, reason: "no_matching_employee" };
    }

    const { data: doc, error: docErr } = await supabase
      .from("hr_employee_documents")
      .insert({
        employee_id: employeeId,
        document_type: classification.document_type,
        title: dfile.name || "Imported document",
        storage_path: `drive://${dfile.drive_file_id}`,
        file_url: null,
        file_hash: dfile.file_hash || dfile.md5_checksum,
        original_filename: dfile.name,
        mime_type: dfile.mime_type,
        size_bytes: dfile.size_bytes,
        original_language: classification.language,
        drive_file_id: dfile.drive_file_id,
        provenance: {
          source: "drive_sync",
          drive_file_id: dfile.drive_file_id,
          imported_at: new Date().toISOString(),
        },
        metadata: {
          classification_summary: classification.summary,
          classification_reasoning: classification.reasoning,
          classification_confidence: classification.confidence,
        },
      })
      .select()
      .single();

    if (docErr) {
      await supabase
        .from("drive_files")
        .update({
          classification_status: "failed",
          error_log: appendError(dfile.error_log, `insert_failed: ${docErr.message}`),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driveFileRowId);
      return { routed: false, target_table: target, target_id: null, reason: docErr.message };
    }

    await supabase
      .from("drive_files")
      .update({
        classification_status: "routed",
        target_table: "hr_employee_documents",
        target_id: doc.id,
        target_employee_id: employeeId,
        document_type: classification.document_type,
        original_language: classification.language,
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", driveFileRowId);

    await supabase.from("hr_employee_timeline").insert({
      employee_id: employeeId,
      event_type: "document_imported_from_drive",
      title: `Imported from Drive: ${dfile.name}`,
      description: classification.summary,
      related_table: "hr_employee_documents",
      related_id: doc.id,
      metadata: { drive_file_id: dfile.drive_file_id, document_type: classification.document_type },
    });

    return { routed: true, target_table: "hr_employee_documents", target_id: doc.id };
  }

  if (target === "hr_payslips") {
    if (!employeeId) {
      await supabase
        .from("drive_files")
        .update({
          classification_status: "failed",
          error_log: appendError(dfile.error_log, "no_matching_employee_for_payslip"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driveFileRowId);
      return { routed: false, target_table: target, target_id: null, reason: "no_matching_employee" };
    }

    const periodEnd = classification.effective_date || new Date().toISOString().slice(0, 10);
    const periodStartDate = new Date(periodEnd);
    periodStartDate.setDate(1);

    const { data: slip, error: slipErr } = await supabase
      .from("hr_payslips")
      .insert({
        employee_id: employeeId,
        period_start: periodStartDate.toISOString().slice(0, 10),
        period_end: periodEnd,
        storage_path: `drive://${dfile.drive_file_id}`,
        status: "imported",
        breakdown: {
          source: "drive_sync",
          summary: classification.summary,
        },
      })
      .select()
      .single();

    if (slipErr) {
      await supabase
        .from("drive_files")
        .update({
          classification_status: "failed",
          error_log: appendError(dfile.error_log, `payslip_insert_failed: ${slipErr.message}`),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driveFileRowId);
      return { routed: false, target_table: target, target_id: null, reason: slipErr.message };
    }

    await supabase
      .from("drive_files")
      .update({
        classification_status: "routed",
        target_table: "hr_payslips",
        target_id: slip.id,
        target_employee_id: employeeId,
        document_type: "payslip",
        original_language: classification.language,
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", driveFileRowId);

    return { routed: true, target_table: "hr_payslips", target_id: slip.id };
  }

  // Other targets (ct_contracts, hr_attendance) require richer extraction;
  // for now we record them as classified but not routed so a human can finish.
  await supabase
    .from("drive_files")
    .update({
      classification_status: "classified",
      target_table: target,
      document_type: classification.document_type,
      original_language: classification.language,
      target_employee_id: employeeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", driveFileRowId);

  return {
    routed: false,
    target_table: target,
    target_id: null,
    reason: "needs_human_review",
  };
}

function appendError(existing: unknown, message: string): unknown {
  const arr = Array.isArray(existing) ? existing : [];
  return [...arr, { at: new Date().toISOString(), message }];
}
