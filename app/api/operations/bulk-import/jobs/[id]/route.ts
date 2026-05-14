import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/operations/bulk-import/jobs/:id — full status snapshot.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from("op_bulk_import_jobs")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  const { data: items } = await supabase
    .from("op_bulk_import_items")
    .select("*")
    .eq("job_id", params.id)
    .order("report_index", { ascending: true });
  const counts = (items || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({ job, items: items || [], counts });
}
