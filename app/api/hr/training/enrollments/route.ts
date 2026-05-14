import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createAdminClient();
  const employee_id = url.searchParams.get("employee_id");
  const course_id = url.searchParams.get("course_id");

  let query = supabase
    .from("hr_training_enrollments")
    .select("*, employee:hr_employees(id, full_name), course:hr_training_courses(id, title)")
    .order("enrolled_at", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (course_id) query = query.eq("course_id", course_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollments: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.course_id)
    return NextResponse.json({ error: "employee_id, course_id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_training_enrollments")
    .insert({
      employee_id: body.employee_id,
      course_id: body.course_id,
      status: body.status || "enrolled",
      enrolled_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollment: data });
}
