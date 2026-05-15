import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError } = await requireApiAuth({ minimumRole: "admin" });
    if (authError) return authError;

    const admin = createAdminClient();

    const body = await request.json();
    const { data, error } = await admin.from("user_profiles").update({ role: body.role }).eq("id", params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError, user } = await requireApiAuth({ minimumRole: "admin" });
    if (authError) return authError;
    if (user!.id === params.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

    const admin = createAdminClient();

    await admin.from("user_profiles").delete().eq("id", params.id);
    await admin.auth.admin.deleteUser(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
