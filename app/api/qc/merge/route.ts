import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Fields safely back-filled onto the surviving record when it is empty.
const BACKFILL_FIELDS = [
  "phone",
  "whatsapp_phone",
  "email",
  "national_id",
  "employee_code",
  "position",
  "department_id",
  "hire_date",
  "date_of_birth",
  "address",
  "photo_url",
  "gender",
];

/**
 * POST /api/qc/merge
 * Body: { keep_id, merge_id }
 *
 * Resolves a duplicate: the `merge_id` record is pointed at `keep_id`
 * via merged_into_id and deactivated. Any field that is empty on the
 * surviving record is back-filled from the merged one (including a
 * shallow merge of the government_ids jsonb), so no data is lost.
 *
 * Historical rows (payslips, attendance, ...) keep their original
 * employee_id — every roster query already filters on
 * `merged_into_id is null`, and the pointer lets callers follow the
 * chain when needed. This keeps the merge reversible and avoids a
 * risky cross-table FK rewrite.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { keep_id, merge_id } = await request.json();
    if (!keep_id || !merge_id) {
      return NextResponse.json({ error: "keep_id and merge_id are required" }, { status: 400 });
    }
    if (keep_id === merge_id) {
      return NextResponse.json({ error: "keep_id and merge_id must differ" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: rows, error: fetchErr } = await admin
      .from("op_employees")
      .select("*")
      .in("id", [keep_id, merge_id]);

    if (fetchErr || !rows || rows.length !== 2) {
      return NextResponse.json({ error: "One or both employees not found" }, { status: 404 });
    }

    const keep = rows.find((r) => r.id === keep_id)!;
    const merge = rows.find((r) => r.id === merge_id)!;

    if (merge.merged_into_id) {
      return NextResponse.json(
        { error: "merge_id is already merged into another record" },
        { status: 422 }
      );
    }
    if (keep.merged_into_id) {
      return NextResponse.json(
        { error: "keep_id is itself a merged record" },
        { status: 422 }
      );
    }

    const backfill: Record<string, unknown> = {};
    for (const f of BACKFILL_FIELDS) {
      if ((keep[f] === null || keep[f] === undefined || keep[f] === "") && merge[f]) {
        backfill[f] = merge[f];
      }
    }
    const keepGov = (keep.government_ids as Record<string, string>) || {};
    const mergeGov = (merge.government_ids as Record<string, string>) || {};
    const mergedGov = { ...mergeGov, ...keepGov };
    for (const k of Object.keys(mergedGov)) {
      if (!mergedGov[k] && mergeGov[k]) mergedGov[k] = mergeGov[k];
    }
    if (JSON.stringify(mergedGov) !== JSON.stringify(keepGov)) {
      backfill.government_ids = mergedGov;
    }

    if (Object.keys(backfill).length > 0) {
      backfill.updated_at = new Date().toISOString();
      await admin.from("op_employees").update(backfill).eq("id", keep_id);
    }

    const { error: mergeErr } = await admin
      .from("op_employees")
      .update({
        merged_into_id: keep_id,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", merge_id);

    if (mergeErr) {
      console.error("QC merge update error:", mergeErr);
      return NextResponse.json({ error: mergeErr.message }, { status: 500 });
    }

    await admin.from("hr_employee_timeline").insert({
      employee_id: keep_id,
      event_type: "record_merged",
      title: "Duplicate record merged",
      description: `Merged duplicate record "${merge.full_name}" into this employee.`,
      related_table: "op_employees",
      related_id: merge_id,
      actor_user_id: user.id,
      metadata: { merged_id: merge_id, backfilled: Object.keys(backfill) },
    });

    return NextResponse.json({
      success: true,
      keep_id,
      merge_id,
      backfilled: Object.keys(backfill).filter((k) => k !== "updated_at"),
    });
  } catch (err) {
    console.error("QC merge error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
