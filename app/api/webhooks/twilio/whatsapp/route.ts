import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTwilioSignature, twimlMessage } from "@/lib/twilio/inbound";
import { matchEmployeeByPhone } from "@/lib/operations/match-employee";
import { normalizePhone } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Inbound WhatsApp from Twilio. Must reply within 15s, so we do the bare
// minimum here (resolve sender, persist queued report, fire-and-forget the
// processing job) and return TwiML.

function twimlResponse(body: string, status = 200): Response {
  return new Response(twimlMessage(body), {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const formText = await request.text();
  const params = Object.fromEntries(new URLSearchParams(formText));

  // Twilio signs the URL exactly as Twilio called it. Use the request URL.
  const signature = request.headers.get("x-twilio-signature");
  const fullUrl = request.nextUrl.toString();
  if (!verifyTwilioSignature(signature, fullUrl, params)) {
    // Do NOT log the payload, headers, From, or Body. An attacker can forge a
    // POST to this endpoint; persisting their text in our logs is a leak vector.
    // Log only non-sensitive metadata (route + outcome).
    console.warn("twilio webhook: signature verification failed", {
      route: "/api/webhooks/twilio/whatsapp",
      hasSignatureHeader: Boolean(signature),
    });
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createAdminClient();

  const fromRaw = params.From || "";
  const fromPhone = normalizePhone(fromRaw);
  const body = params.Body || "";
  const sid = params.MessageSid || "";
  const numMedia = parseInt(params.NumMedia || "0", 10);
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const u = params[`MediaUrl${i}`];
    if (u) mediaUrls.push(u);
  }

  if (!sid || !fromPhone) {
    return twimlResponse("פנייה לא תקינה. נא לנסות שוב.");
  }

  // Idempotency: if we've already created a report for this MessageSid, do nothing
  const { data: existing } = await supabase
    .from("op_reports")
    .select("id")
    .eq("source_meta->>twilio_message_sid", sid)
    .maybeSingle();
  if (existing) {
    return twimlResponse("הדוח כבר התקבל ומעובד.");
  }

  const match = await matchEmployeeByPhone(supabase, fromPhone);

  if (!match.employee_id) {
    // Quarantine the message
    const { data: existingInbox } = await supabase
      .from("op_inbox_unmatched")
      .select("id")
      .eq("twilio_message_sid", sid)
      .maybeSingle();
    if (!existingInbox) {
      await supabase.from("op_inbox_unmatched").insert({
        from_phone: fromPhone,
        body,
        media_urls: mediaUrls,
        twilio_message_sid: sid,
      });
    }
    return twimlResponse(
      "המספר שלך אינו רשום במערכת התפעול של Blueprint HR. אנא פנה למנהל המערכת לרישום.\nYour number is not registered in Blueprint HR Operations. Please ask the admin to register you."
    );
  }

  // Known sender — persist a queued report
  const { data: report, error: insErr } = await supabase
    .from("op_reports")
    .insert({
      source_type: "whatsapp",
      raw_text: body,
      source_meta: {
        twilio_message_sid: sid,
        media_urls: mediaUrls,
        from: fromPhone,
      },
      report_date: new Date().toISOString().slice(0, 10),
      submitted_by_phone: fromPhone,
      submitted_by_employee_id: match.employee_id,
      processing_status: "queued",
    })
    .select()
    .single();

  if (insErr || !report) {
    console.error("twilio webhook: insert failed", insErr);
    return twimlResponse("שגיאה בקליטת הדוח. אנא נסה שוב מאוחר יותר.");
  }

  // Fire-and-forget the processing job. Do NOT await.
  const procUrl = new URL("/api/operations/reports/process", request.nextUrl.origin);
  fetch(procUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report_id: report.id }),
  }).catch((e) => console.error("twilio webhook: fire-and-forget failed", e));

  const ack = mediaUrls.length > 0
    ? "התקבל ✓ מעבד את הדוח והקבצים המצורפים..."
    : "התקבל ✓ מעבד את הדוח...";
  return twimlResponse(ack);
}

// Allow Twilio's GET-based webhook validation if configured
export async function GET() {
  return new Response("OK", { status: 200 });
}
