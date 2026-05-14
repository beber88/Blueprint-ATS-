import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {};
  if (body.dismiss === true) update.resolved_at = new Date().toISOString();
  if (body.reopen === true) update.resolved_at = null;
  const { data, error } = await supabase.from("op_alerts").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}
