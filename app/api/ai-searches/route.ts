import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET - list search history
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_searches")
      .select("id, query, locale, ai_summary, total_found, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ searches: data || [] });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST - save a search result
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("ai_searches")
      .insert({
        query: body.query,
        locale: body.locale || "he",
        search_params: body.search_params,
        results: body.results,
        ai_summary: body.ai_summary,
        total_found: body.total_found || 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
