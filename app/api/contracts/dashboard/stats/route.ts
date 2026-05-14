import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContractKpis } from "@/lib/contracts/queries";

export const dynamic = "force-dynamic";

// GET /api/contracts/dashboard/stats — KPI tiles for the dashboard.
export async function GET() {
  const supabase = createAdminClient();
  try {
    const kpis = await getContractKpis(supabase);
    return NextResponse.json({ kpis });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
