import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
