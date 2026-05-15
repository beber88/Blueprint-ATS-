import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const HR_BUCKET = "hr-documents";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Pull all documents that look government-related (by document_type
    //    or by document_type='id' since IDs are also government issued).
    const { data: docs, error } = await supabase
      .from("hr_employee_documents")
      .select(
        "id, employee_id, document_type, title, storage_path, file_url, original_language, expiry_date, created_at, employee:op_employees!employee_id(id, full_name, government_ids, national_id)"
      )
      .in("document_type", ["government", "id", "tax"])
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Govt docs query error:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    const enriched = (docs || []).map((d) => ({
      ...d,
      file_url:
        d.file_url ||
        (d.storage_path && !d.storage_path.startsWith("drive://")
          ? supabase.storage.from(HR_BUCKET).getPublicUrl(d.storage_path).data?.publicUrl || null
          : null),
    }));

    // 2. Compute per-employee compliance summary (which IDs are filled in).
    const { data: employees } = await supabase
      .from("op_employees")
      .select("id, full_name, government_ids, national_id, is_active")
      .eq("is_active", true);

    const compliance = (employees || []).map((emp) => {
      const ids = (emp.government_ids as Record<string, string | null>) || {};
      const fields = ["sss_no", "philhealth_no", "pagibig_no", "tin"];
      const filled = fields.filter((f) => ids[f]);
      return {
        id: emp.id,
        full_name: emp.full_name,
        national_id: emp.national_id,
        filled_count: filled.length,
        total_count: fields.length,
        missing: fields.filter((f) => !ids[f]),
      };
    });

    return NextResponse.json({ documents: enriched, compliance });
  } catch (err) {
    console.error("Government docs error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
