import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UPDATABLE_FIELDS = [
  "full_name",
  "full_name_en",
  "full_name_he",
  "full_name_tl",
  "employee_code",
  "email",
  "phone",
  "position",
  "department_id",
  "hire_date",
  "employment_status",
  "birth_date",
  "address",
  "emergency_contact",
  "government_ids",
  "photo_url",
  "notes",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: employee, error } = await supabase
      .from("employees")
      .select("*, department:departments(id, name, name_en, name_he, name_tl)")
      .eq("id", id)
      .single();

    if (error || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const [{ data: documents }, { data: timeline }] = await Promise.all([
      supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("employee_timeline")
        .select("*")
        .eq("employee_id", id)
        .order("event_date", { ascending: false })
        .limit(100),
    ]);

    return NextResponse.json({
      ...employee,
      documents: documents || [],
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
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) update[key] = body[key];
    }

    const { data: previous } = await supabase
      .from("employees")
      .select("employment_status, position, department_id")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("employees")
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
          description: `${previous.employment_status} → ${body.employment_status}`,
        });
      }
      if (body.position && body.position !== previous.position) {
        events.push({
          event_type: "position_changed",
          title: "Position updated",
          description: `${previous.position ?? "—"} → ${body.position}`,
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
        await supabase.from("employee_timeline").insert(
          events.map((e) => ({ ...e, employee_id: id }))
        );
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

    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
