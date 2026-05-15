import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const FIELDS = [
  "title",
  "category",
  "counterparty_name",
  "counterparty_contact_name",
  "counterparty_contact_email",
  "counterparty_contact_phone",
  "summary",
  "signing_date",
  "effective_date",
  "expiration_date",
  "renewal_date",
  "monetary_value",
  "currency",
  "is_renewable",
  "status",
  "obligations_json",
  "flagged_for_review",
  "folder_id",
  "project_id",
  "storage_path",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("ct_contracts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const { data: alerts } = await admin
      .from("ct_alerts")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ...data, alerts: alerts || [] });
  } catch (err) {
    console.error("Contract GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const f of FIELDS) if (f in body) update[f] = body[f];

    const { data, error } = await admin
      .from("ct_contracts")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Contract PATCH error:", err);
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

    const { error } = await admin.from("ct_contracts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contract DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
