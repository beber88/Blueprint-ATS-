import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_shift_definitions")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shifts: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.start_time || !body.end_time)
    return NextResponse.json({ error: "name, start_time, end_time required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_shift_definitions")
    .insert({
      name: body.name,
      start_time: body.start_time,
      end_time: body.end_time,
      break_minutes: body.break_minutes || 0,
      color: body.color || null,
      is_active: body.is_active !== false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shift: data });
}
