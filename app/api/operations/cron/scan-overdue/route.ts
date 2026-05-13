import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdueItems } = await supabase
    .from("op_report_items")
    .select("id, issue, deadline, priority, project_id, department_id")
    .lt("deadline", today)
    .neq("status", "resolved");

  let createdAlerts = 0;

  for (const item of overdueItems || []) {
    const { data: existing } = await supabase
      .from("op_alerts")
      .select("id")
      .eq("item_id", item.id)
      .eq("type", "overdue")
      .is("resolved_at", null)
      .maybeSingle();

    if (!existing) {
      const days = Math.floor((Date.now() - new Date(item.deadline).getTime()) / 86400000);
      await supabase.from("op_alerts").insert({
        item_id: item.id,
        project_id: item.project_id,
        type: "overdue",
        severity: item.priority === "urgent" ? "urgent" : item.priority === "high" ? "high" : "medium",
        message: `פריט באיחור של ${days} ימים: ${item.issue.slice(0, 120)}`,
      });
      createdAlerts++;
    }
  }

  return NextResponse.json({ ok: true, scanned: overdueItems?.length || 0, created: createdAlerts });
}

export const POST = GET;
