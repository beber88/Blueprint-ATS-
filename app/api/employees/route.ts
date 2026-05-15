import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SELECT_LIST =
  "id, employee_code, full_name, email, phone, position, role, employment_status, is_active, hire_date, photo_url, created_at, department:op_departments!department_id(id, name)";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("op_employees")
      .select(SELECT_LIST, { count: "exact" })
      .is("merged_into_id", null);

    if (status) {
      query = query.eq("employment_status", status);
    } else if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }
    if (search) {
      const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
      query = query.or(
        `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,employee_code.ilike.%${escaped}%,position.ilike.%${escaped}%,role.ilike.%${escaped}%`
      );
    }

    query = query.order("full_name", { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("Employees query error:", error);
      return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
    }

    return NextResponse.json({ employees: data, total: count, page, limit });
  } catch (error) {
    console.error("Employees GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    if (!body.full_name || typeof body.full_name !== "string") {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }

    const employmentStatus = body.employment_status || "active";

    const insertPayload: Record<string, unknown> = {
      full_name: body.full_name,
      full_name_en: body.full_name_en || body.full_name,
      full_name_he: body.full_name_he || null,
      full_name_tl: body.full_name_tl || null,
      employee_code: body.employee_code || null,
      email: body.email || null,
      phone: body.phone || null,
      whatsapp_phone: body.whatsapp_phone || null,
      position: body.position || null,
      role: body.position || body.role || null,
      department_id: body.department_id || null,
      project_id: body.project_id || null,
      hire_date: body.hire_date || null,
      employment_status: employmentStatus,
      is_active: employmentStatus === "active" || employmentStatus === "probation" || employmentStatus === "on_leave",
      employment_type: body.employment_type || "full-time",
      date_of_birth: body.birth_date || body.date_of_birth || null,
      gender: body.gender || null,
      address: body.address || null,
      emergency_contact: body.emergency_contact || {},
      government_ids: body.government_ids || {},
      national_id: body.government_ids?.national_id || body.national_id || null,
      photo_url: body.photo_url || null,
      source: body.source || "manual",
      source_metadata: body.source_metadata || {},
      notes: body.notes || null,
      candidate_id: body.candidate_id || null,
      manager_id: body.manager_id || null,
    };

    const { data, error } = await supabase
      .from("op_employees")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("Employee insert error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create employee" },
        { status: 500 }
      );
    }

    await supabase.from("hr_employee_timeline").insert({
      employee_id: data.id,
      event_type: "employee_created",
      title: "Employee created",
      description: `Employee ${data.full_name} added to the system`,
      metadata: { source: data.source },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Employees POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
