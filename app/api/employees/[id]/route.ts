import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UPDATABLE_FIELDS: Record<string, string> = {
  full_name: "full_name",
  full_name_en: "full_name_en",
  full_name_he: "full_name_he",
  full_name_tl: "full_name_tl",
  employee_code: "employee_code",
  email: "email",
  phone: "phone",
  whatsapp_phone: "whatsapp_phone",
  position: "position",
  role: "role",
  department_id: "department_id",
  project_id: "project_id",
  hire_date: "hire_date",
  employment_status: "employment_status",
  employment_type: "employment_type",
  manager_id: "manager_id",
  salary_grade: "salary_grade",
  birth_date: "date_of_birth",
  date_of_birth: "date_of_birth",
  gender: "gender",
  address: "address",
  emergency_contact: "emergency_contact",
  government_ids: "government_ids",
  national_id: "national_id",
  photo_url: "photo_url",
  notes: "notes",
};

const SELECT_FULL =
  "*, department:op_departments!department_id(id, name, name_en, name_he, name_tl)";

const HR_BUCKET = "hr-documents";

function publicUrl(supabase: ReturnType<typeof createAdminClient>, storagePath: string | null) {
  if (!storagePath) return null;
  const { data } = supabase.storage.from(HR_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: employee, error } = await supabase
      .from("op_employees")
      .select(SELECT_FULL)
      .eq("id", id)
      .single();

    if (error || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const [{ data: documents }, { data: timeline }] = await Promise.all([
      supabase
        .from("hr_employee_documents")
        .select("*")
        .eq("employee_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("hr_employee_timeline")
        .select("*")
        .eq("employee_id", id)
        .order("event_date", { ascending: false })
        .limit(100),
    ]);

    const documentsWithUrls = (documents || []).map((d) => ({
      ...d,
      file_url: d.file_url || publicUrl(supabase, d.storage_path),
    }));

    return NextResponse.json({
      ...employee,
      documents: documentsWithUrls,
      timeline: timeline || [],
    });
  } catch (error) {
    console.error("Employee GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const [bodyKey, dbColumn] of Object.entries(UPDATABLE_FIELDS)) {
      if (bodyKey in body) update[dbColumn] = body[bodyKey];
    }

    if ("employment_status" in body) {
      const status = body.employment_status;
      update.is_active =
        status === "active" || status === "probation" || status === "on_leave";
    }

    if ("position" in body && !("role" in body)) {
      update.role = body.position;
    }

    const { data: previous } = await supabase
      .from("op_employees")
      .select("employment_status, position, role, department_id")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("op_employees")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Employee update error:", error);
      return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
    }

    if (previous) {
      const events: Array<{ event_type: string; title: string; description: string }> = [];
      if (body.employment_status && body.employment_status !== previous.employment_status) {
        events.push({
          event_type: "status_changed",
          title: "Employment status changed",
          description: `${previous.employment_status ?? "—"} → ${body.employment_status}`,
        });
      }
      const newPosition = body.position || body.role;
      const oldPosition = previous.position || previous.role;
      if (newPosition && newPosition !== oldPosition) {
        events.push({
          event_type: "position_changed",
          title: "Position updated",
          description: `${oldPosition ?? "—"} → ${newPosition}`,
        });
      }
      if (body.department_id && body.department_id !== previous.department_id) {
        events.push({
          event_type: "department_changed",
          title: "Department updated",
          description: "Department reassigned",
        });
      }
      if (events.length) {
        await supabase
          .from("hr_employee_timeline")
          .insert(events.map((e) => ({ ...e, employee_id: id })));
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Employee PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase.from("op_employees").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
