import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// POST /api/operations/bulk-import/jobs/:id/resume
//
// Recovery action only — used when a worker container died mid-flight.
// We do not re-run the Claude extraction here; instead we:
//   1. Mark stuck 'processing' items (older than 1 hour) as 'failed'
//      so the operator can see the human-readable count.
//   2. Flip the job back to 'queued' if it has any 'pending' work left.
//
// To actually re-execute, the caller should POST to /api/operations/bulk-import
// again with force=true (the duplicate-batch guard otherwise blocks).
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const supabase = createAdminClient();

  const { data: job, error: jobErr } = await supabase
    .from("op_bulk_import_jobs")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (jobErr || !job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  if (job.status === "done") {
    return NextResponse.json(
      { error: "job is done — nothing to resume" },
      { status: 409 }
    );
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stuck } = await supabase
    .from("op_bulk_import_items")
    .update({
      status: "failed",
      error_message: "worker timed out (resume detected processing item older than 1h)",
      processed_at: new Date().toISOString(),
    })
    .eq("job_id", params.id)
    .eq("status", "processing")
    .lt("created_at", oneHourAgo)
    .select();

  // If items are still pending, the job is queued again. Otherwise we
  // leave the status alone so the operator can interpret the final state.
  const { data: pending } = await supabase
    .from("op_bulk_import_items")
    .select("id")
    .eq("job_id", params.id)
    .eq("status", "pending");

  if ((pending || []).length > 0) {
    await supabase
      .from("op_bulk_import_jobs")
      .update({ status: "queued" })
      .eq("id", params.id);
  }

  return NextResponse.json({
    ok: true,
    stuckMarkedFailed: stuck?.length || 0,
    pendingRemaining: (pending || []).length,
  });
}
