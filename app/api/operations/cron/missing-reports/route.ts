import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: missing } = await supabase.from("op_missing_reports_v").select("*");

  let created = 0;
  for (const m of missing || []) {
    const { data: existing } = await supabase
      .from("op_alerts")
      .select("id, created_at")
      .eq("project_id", m.project_id)
      .eq("type", "missing_report")
      .is("resolved_at", null)
      .maybeSingle();

    // Don't double-flag the same project on the same day
    const today = new Date().toISOString().slice(0, 10);
    if (existing && existing.created_at?.slice(0, 10) === today) continue;

    await supabase.from("op_alerts").insert({
      project_id: m.project_id,
      type: "missing_report",
      severity: "high",
      message: `לא התקבל דוח אתמול עבור פרויקט: ${m.project_name}`,
    });
    created++;
  }

  return NextResponse.json({ ok: true, missing: (missing || []).length, created });
}

export const POST = GET;
