import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_training_courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courses: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.title)
    return NextResponse.json({ error: "title required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_training_courses")
    .insert({
      title: body.title,
      description: body.description || null,
      category: body.category || null,
      duration_hours: body.duration_hours || null,
      provider: body.provider || null,
      is_mandatory: body.is_mandatory || false,
      status: body.status || "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course: data });
}
