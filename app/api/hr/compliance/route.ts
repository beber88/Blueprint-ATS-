import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const REQUIRED_IDS = ["sss", "philhealth", "pagibig", "tin"];

export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();

  const { data: employees } = await supabase
    .from("op_employees")
    .select("id, full_name, department_id, government_ids")
    .eq("is_active", true)
    .order("full_name");

  // Get government documents from hr_employee_documents
  const { data: docs } = await supabase
    .from("hr_employee_documents")
    .select("employee_id, document_type, title, expiry_date")
    .eq("document_type", "government");

  const docsByEmployee = new Map<string, Array<{ title: string; expiry_date: string | null }>>();
  for (const d of docs || []) {
    if (!docsByEmployee.has(d.employee_id)) docsByEmployee.set(d.employee_id, []);
    docsByEmployee.get(d.employee_id)!.push({ title: d.title, expiry_date: d.expiry_date });
  }

  const results = (employees || []).map((emp) => {
    const govIds = (emp.government_ids as Record<string, string>) || {};
    const empDocs = docsByEmployee.get(emp.id) || [];

    const ids: Record<string, { number: string | null; has_document: boolean }> = {};
    for (const id of REQUIRED_IDS) {
      ids[id] = {
        number: govIds[id] || null,
        has_document: empDocs.some((d) => d.title.toLowerCase().includes(id)),
      };
    }

    const missingIds = REQUIRED_IDS.filter((id) => !ids[id].number);
    const missingDocs = REQUIRED_IDS.filter((id) => !ids[id].has_document);
    const isCompliant = missingIds.length === 0;

    return {
      employee_id: emp.id,
      employee_name: emp.full_name,
      department_id: emp.department_id,
      ids,
      missing_ids: missingIds,
      missing_docs: missingDocs,
      is_compliant: isCompliant,
      compliance_score: Math.round(((REQUIRED_IDS.length - missingIds.length) / REQUIRED_IDS.length) * 100),
    };
  });

  const compliant = results.filter((r) => r.is_compliant).length;

  return NextResponse.json({
    employees: results,
    summary: {
      total: results.length,
      compliant,
      non_compliant: results.length - compliant,
      compliance_rate: results.length > 0 ? Math.round((compliant / results.length) * 100) : 0,
    },
  });
}
