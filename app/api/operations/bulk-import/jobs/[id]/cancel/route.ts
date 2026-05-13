import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/operations/bulk-import/jobs/:id/cancel
// Marks the job as cancelled and flips any still-pending items to
// 'cancelled'. Items already in 'processing' finish naturally — the
// worker re-checks job status before each item and exits early on
// cancellation.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { data: job, error: jobErr } = await supabase
    .from("op_bulk_import_jobs")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (jobErr || !job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json(
      { error: `job is already ${job.status} — cannot cancel` },
      { status: 409 }
    );
  }

  await supabase
    .from("op_bulk_import_jobs")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", params.id);

  await supabase
    .from("op_bulk_import_items")
    .update({ status: "cancelled" })
    .eq("job_id", params.id)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
