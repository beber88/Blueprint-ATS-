import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDuplicates, type QcEmployee } from "@/lib/qc/duplicates";

export const dynamic = "force-dynamic";

/**
 * GET /api/qc/duplicates
 *
 * Scans the non-merged employee roster for likely duplicate records
 * and returns candidate pairs ordered by confidence.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("op_employees")
      .select("id, full_name, email, phone, whatsapp_phone, national_id, employee_code, created_at")
      .is("merged_into_id", null);

    if (error) {
      console.error("QC duplicates query error:", error);
      return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
    }

    const employees = (data || []) as (QcEmployee & { created_at: string })[];
    const pairs = findDuplicates(employees);

    return NextResponse.json({
      pairs,
      scanned: employees.length,
    });
  } catch (err) {
    console.error("QC duplicates error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
