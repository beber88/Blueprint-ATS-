import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runEmployeeDeadlineScan } from "@/lib/hr/cron-deadlines";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron — scans employee profile data for date-based alert
// conditions and emits unresolved hr_alerts rows.
//
// Schedule (vercel.json): "0 5 * * *" — daily 05:00 UTC =
// 08:00 IDT / 13:00 PHT.
//
// Idempotency: hr_alerts has a partial unique index on
// (employee_id, type) WHERE resolved_at IS NULL. The runner
// pre-checks for an open alert before each insert so re-runs
// don't even attempt duplicate writes.
function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode — no secret set
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  try {
    const result = await runEmployeeDeadlineScan(supabase, new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Vercel cron triggers can also POST; accept both verbs.
export const POST = GET;
