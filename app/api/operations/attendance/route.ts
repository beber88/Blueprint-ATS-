import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// Reads the op_attendance_v view (items where category='attendance').
export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("op_attendance_v")
    .select("*")
    .gte("report_date", since)
    .order("report_date", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by employee_name
  const byEmployee: Record<string, { name: string; count: number; latest: string; items: typeof data }> = {};
  for (const r of data || []) {
    const name = r.employee_name || "(לא ידוע)";
    if (!byEmployee[name]) byEmployee[name] = { name, count: 0, latest: r.report_date, items: [] };
    byEmployee[name].count++;
    if (r.report_date > byEmployee[name].latest) byEmployee[name].latest = r.report_date;
    byEmployee[name].items.push(r);
  }

  return NextResponse.json({
    items: data || [],
    by_employee: Object.values(byEmployee).sort((a, b) => b.count - a.count),
  });
}
