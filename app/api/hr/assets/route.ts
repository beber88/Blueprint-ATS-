import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const url = new URL(request.url);
  const supabase = createAdminClient();
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  let query = supabase
    .from("hr_assets")
    .select("*")
    .order("name");

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.name)
    return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_assets")
    .insert({
      name: body.name,
      category: body.category || null,
      serial_number: body.serial_number || null,
      purchase_date: body.purchase_date || null,
      purchase_cost: body.purchase_cost || null,
      status: body.status || "available",
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}
