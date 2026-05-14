import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createAdminClient();

  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  let query = supabase
    .from("hr_emails")
    .select("*", { count: "exact" })
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("processing_status", status);
  if (category) query = query.eq("routed_to", category);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    emails: data || [],
    total: count || 0,
  });
}
