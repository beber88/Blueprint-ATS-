import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  "draft_source_id",
  "folder_id",
  "project_id",
  "storage_path",
];

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    let query = supabase
      .from("ct_contracts")
      .select(
        "id, title, category, counterparty_name, status, signing_date, effective_date, expiration_date, monetary_value, currency, is_renewable, flagged_for_review, created_at"
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) {
      const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
      query = query.or(
        `title.ilike.%${escaped}%,counterparty_name.ilike.%${escaped}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("Contracts query error:", error);
      return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 });
    }

    return NextResponse.json({ contracts: data || [] });
  } catch (err) {
    console.error("Contracts GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    if (!body.title || !body.counterparty_name || !body.category) {
      return NextResponse.json(
        { error: "title, counterparty_name, and category are required" },
        { status: 400 }
      );
    }

    const insert: Record<string, unknown> = { created_by: user.id };
    for (const f of FIELDS) {
      if (f in body) insert[f] = body[f];
    }
    if (Array.isArray(body.obligations) && !("obligations_json" in body)) {
      insert.obligations_json = body.obligations;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ct_contracts")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("Contract insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.draft_source_id) {
      await admin
        .from("ct_contract_drafts")
        .update({ status: "saved", saved_contract_id: data.id, updated_at: new Date().toISOString() })
        .eq("id", body.draft_source_id);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Contracts POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
