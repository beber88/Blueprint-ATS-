import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("op_departments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const { data: employees } = await supabase
      .from("op_employees")
      .select("id, full_name, position, role, employment_status, is_active, photo_url")
      .eq("department_id", id)
      .eq("is_active", true)
      .order("full_name");

    return NextResponse.json({ ...data, employees: employees || [] });
  } catch (error) {
    console.error("Department GET error:", error);
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
    for (const k of [
      "code",
      "name",
      "name_en",
      "name_he",
      "name_tl",
      "description",
      "parent_department_id",
      "head_employee_id",
      "cost_center",
      "color",
    ]) {
      if (k in body) update[k] = body[k];
    }

    const { data, error } = await supabase
      .from("op_departments")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Department update error:", error);
      return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Department PATCH error:", error);
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

    const { count } = await supabase
      .from("op_employees")
      .select("id", { count: "exact", head: true })
      .eq("department_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete department with active employees. Reassign them first.",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("op_departments").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Department DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
