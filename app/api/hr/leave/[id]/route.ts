import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_leave_requests")
    .select("*, employee:hr_employees(id, full_name, email, department)")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leave_request: data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const supabase = createAdminClient();

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "approved" || body.status === "rejected") {
    update.approved_by = body.approved_by || null;
    update.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("hr_leave_requests")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When approved, update leave balance used_days
  if (body.status === "approved" && data.days && data.employee_id && data.leave_type) {
    await supabase.rpc("increment_leave_used_days", {
      p_employee_id: data.employee_id,
      p_leave_type: data.leave_type,
      p_days: data.days,
    }).then(({ error: balErr }) => {
      if (balErr) {
        // Fallback: direct update
        supabase
          .from("hr_leave_balances")
          .update({ used_days: data.days })
          .eq("employee_id", data.employee_id)
          .eq("leave_type", data.leave_type);
      }
    });
  }

  return NextResponse.json({ leave_request: data });
}
