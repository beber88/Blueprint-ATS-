import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import { findDuplicates, type QcEmployee } from "@/lib/hr/qc/duplicates";

export const dynamic = "force-dynamic";

/**
 * GET /api/hr/qc/duplicates
 *
 * Scans the non-merged employee roster for likely duplicate records
 * and returns candidate pairs ordered by confidence.
 */
export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_employees")
    .select("id, full_name, email, phone, whatsapp_phone, national_id, employee_code")
    .is("merged_into_id", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const employees = (data || []) as QcEmployee[];
  const pairs = findDuplicates(employees);

  return NextResponse.json({
    pairs,
    scanned: employees.length,
  });
}
