import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Departments query error:", error);
      return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
    }

    const { data: counts } = await supabase
      .from("employees")
      .select("department_id")
      .neq("employment_status", "terminated");

    const countMap = new Map<string, number>();
    (counts || []).forEach((row: { department_id: string | null }) => {
      if (row.department_id) {
        countMap.set(row.department_id, (countMap.get(row.department_id) || 0) + 1);
      }
    });

    const enriched = (data || []).map((d: { id: string }) => ({
      ...d,
      employee_count: countMap.get(d.id) || 0,
    }));

    return NextResponse.json({ departments: enriched });
  } catch (error) {
    console.error("Departments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("departments")
      .insert({
        name: body.name,
        name_en: body.name_en || body.name,
        name_he: body.name_he || null,
        name_tl: body.name_tl || null,
        description: body.description || null,
        parent_department_id: body.parent_department_id || null,
        cost_center: body.cost_center || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Department insert error:", error);
      return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Department POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
