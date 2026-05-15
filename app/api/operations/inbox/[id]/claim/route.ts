import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// Claim a quarantined WhatsApp message: link it to an op_employees row, then
// create a real op_reports row from the quarantined payload and trigger
// processing.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  const body = await request.json().catch(() => ({}));
  if (!body.employee_id) return NextResponse.json({ error: "employee_id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: inbox } = await supabase.from("op_inbox_unmatched").select("*").eq("id", params.id).single();
  if (!inbox) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inbox.resulting_report_id) {
    return NextResponse.json({ error: "Already claimed", report_id: inbox.resulting_report_id }, { status: 400 });
  }

  const { data: emp } = await supabase.from("op_employees").select("*").eq("id", body.employee_id).single();
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { data: report, error: insErr } = await supabase
    .from("op_reports")
    .insert({
      source_type: "whatsapp",
      raw_text: inbox.body || "",
      source_meta: {
        twilio_message_sid: inbox.twilio_message_sid,
        media_urls: inbox.media_urls || [],
        claimed_from_inbox: inbox.id,
      },
      report_date: new Date().toISOString().slice(0, 10),
      submitted_by_phone: inbox.from_phone,
      submitted_by_employee_id: emp.id,
      processing_status: "queued",
    })
    .select()
    .single();

  if (insErr || !report) return NextResponse.json({ error: insErr?.message || "Insert failed" }, { status: 500 });

  await supabase
    .from("op_inbox_unmatched")
    .update({ claimed_employee_id: emp.id, resulting_report_id: report.id })
    .eq("id", params.id);

  // Fire-and-forget processing
  const url = new URL("/api/operations/reports/process", request.nextUrl.origin);
  fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report_id: report.id }),
  }).catch((e) => console.error("inbox claim: fire-and-forget failed", e));

  return NextResponse.json({ ok: true, report_id: report.id });
}
