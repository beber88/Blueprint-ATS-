import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Categories fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
