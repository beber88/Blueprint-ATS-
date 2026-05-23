import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employee_id");
  if (!employeeId) {
    return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hr_employee_notes")
    .select("*")
    .eq("employee_id", employeeId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data || [] });
}

export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.employee_id || !body.note_text) {
    return NextResponse.json({ error: "employee_id, note_text required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_employee_notes")
    .insert({
      employee_id: body.employee_id,
      author_id: profile?.id ?? null,
      note_text: body.note_text,
      visibility: body.visibility === "granted" ? "granted" : "admin",
      pinned: !!body.pinned,
      parent_note_id: body.parent_note_id ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}
