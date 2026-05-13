import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("op_departments").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departments: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.code || !body.name) return NextResponse.json({ error: "code and name required" }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_departments")
    .insert({
      code: String(body.code).toLowerCase(),
      name: body.name,
      name_he: body.name_he || body.name,
      name_en: body.name_en || null,
      name_tl: body.name_tl || null,
      color: body.color || "#C9A84C",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ department: data });
}
