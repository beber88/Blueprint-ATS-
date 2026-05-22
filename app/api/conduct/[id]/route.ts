import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CONDUCT_TYPES = ["disciplinary_action", "recognition"];

/**
 * PATCH /api/conduct/[id]
 * Acknowledges a disciplinary action (records that the employee was
 * informed). Body: { acknowledged: true }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const { data: current, error: curErr } = await admin
      .from("hr_employee_timeline")
      .select("event_type, metadata")
      .eq("id", id)
      .single();
    if (curErr || !current || !CONDUCT_TYPES.includes(current.event_type)) {
      return NextResponse.json({ error: "Conduct record not found" }, { status: 404 });
    }

    const metadata = {
      ...(current.metadata as Record<string, unknown>),
      acknowledged: !!body.acknowledged,
      acknowledged_at: body.acknowledged ? new Date().toISOString() : null,
    };

    const { data, error } = await admin
      .from("hr_employee_timeline")
      .update({ metadata })
      .eq("id", id)
      .select(
        "id, employee_id, event_type, event_date, title, description, metadata, created_at, employee:op_employees!employee_id(id, full_name)"
      )
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Conduct PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: current } = await admin
      .from("hr_employee_timeline")
      .select("event_type")
      .eq("id", id)
      .single();
    if (!current || !CONDUCT_TYPES.includes(current.event_type)) {
      return NextResponse.json({ error: "Conduct record not found" }, { status: 404 });
    }

    const { error } = await admin.from("hr_employee_timeline").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Conduct DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
