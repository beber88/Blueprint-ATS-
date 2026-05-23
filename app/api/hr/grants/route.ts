import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// Admin-only: list grants. Filter by employee_id or user_id.
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({
    module: "hr-management",
    minimumRole: "admin",
  });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employee_id");
  const userId = url.searchParams.get("user_id");
  const onlyActive = url.searchParams.get("active") !== "false";

  let q = supabase.from("hr_profile_grants").select("*").order("granted_at", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (userId) q = q.eq("user_id", userId);
  if (onlyActive) q = q.is("revoked_at", null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grants: data || [] });
}

// Admin grants a user access to an employee's profile.
export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireApiAuth({
    module: "hr-management",
    minimumRole: "admin",
  });
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  if (!body.user_id || !body.employee_id) {
    return NextResponse.json({ error: "user_id, employee_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_profile_grants")
    .insert({
      user_id: body.user_id,
      employee_id: body.employee_id,
      granted_by_user_id: profile?.id ?? "system",
      expires_at: body.expires_at ?? null,
      note: body.note ?? null,
    })
    .select()
    .single();

  if (error) {
    // Partial-unique conflict means an active grant already exists.
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ grant: data });
}
