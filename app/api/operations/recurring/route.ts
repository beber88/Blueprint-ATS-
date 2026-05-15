import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("op_recurring_themes")
    .select("*, project:op_projects(name), department:op_departments(name, name_he, color)")
    .order("occurrence_count", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ themes: data || [] });
}
