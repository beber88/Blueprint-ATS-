import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createAdminClient();
  const employee_id = url.searchParams.get("employee_id");
  const status = url.searchParams.get("status");

  let query = supabase
    .from("hr_performance_reviews")
    .select("*, employee:hr_employees(id, full_name)")
    .order("review_date", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.reviewer_id)
    return NextResponse.json({ error: "employee_id, reviewer_id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_performance_reviews")
    .insert({
      employee_id: body.employee_id,
      reviewer_id: body.reviewer_id,
      review_date: body.review_date || new Date().toISOString().split("T")[0],
      review_period: body.review_period || null,
      rating: body.rating || null,
      goals: body.goals || null,
      feedback: body.feedback || null,
      status: body.status || "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
