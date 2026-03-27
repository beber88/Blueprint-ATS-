import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/gmail/client";
import { sendWhatsApp } from "@/lib/twilio/client";

export const dynamic = "force-dynamic";

async function sendToCandidate(
  supabase: ReturnType<typeof createAdminClient>,
  candidateId: string,
  templateId: string | undefined,
  channel: string,
  variables: Record<string, string>,
  customSubject?: string,
  customBody?: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: candidate } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();

  if (!candidate) return { success: false, error: "Candidate not found" };

  let subject = customSubject || "";
  let messageBody = customBody || "";

  if (templateId) {
    const { data: template } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (template) {
      subject = template.subject || "";
      messageBody = template.body;
      const vars = { candidate_name: candidate.full_name, שם_מועמד: candidate.full_name, ...variables };
      for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        subject = subject.replace(regex, String(value));
        messageBody = messageBody.replace(regex, String(value));
      }
    }
  }

  const toAddress = channel === "email" ? candidate.email : candidate.phone;
  if (!toAddress) return { success: false, error: `No ${channel === "email" ? "email" : "phone"} for ${candidate.full_name}` };

  if (channel === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toAddress)) return { success: false, error: `Invalid email: ${toAddress}` };
  }
  if (channel === "whatsapp") {
    const digitCount = (toAddress.match(/\d/g) || []).length;
    if (digitCount < 7) return { success: false, error: `Invalid phone: ${toAddress}` };
  }

  let status = "sent";
  try {
    if (channel === "email") await sendEmail(toAddress, subject, messageBody);
    else if (channel === "whatsapp") await sendWhatsApp(toAddress, messageBody);
  } catch (err) {
    console.error("Send error:", err);
    status = "failed";
  }

  // Log message
  await supabase.from("messages_sent").insert({
    candidate_id: candidateId,
    template_id: templateId || null,
    channel,
    to_address: toAddress,
    subject,
    body: messageBody,
    status,
  });

  // Update contact status
  const contactStatus = channel === "email" ? "email_sent" : "contacted";
  if (status === "sent") {
    await supabase.from("candidates").update({ contact_status: contactStatus }).eq("id", candidateId);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    candidate_id: candidateId,
    action: `message_${status}`,
    details: { channel, template_id: templateId },
  });

  return status === "sent" ? { success: true } : { success: false, error: "Send failed" };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { candidateId, candidateIds, templateId, channel, variables, customSubject, customBody } = body;

    // Bulk send
    if (candidateIds && Array.isArray(candidateIds) && candidateIds.length > 0) {
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const id of candidateIds) {
        const result = await sendToCandidate(supabase, id, templateId, channel || "email", variables || {}, customSubject, customBody);
        if (result.success) {
          sent++;
        } else {
          failed++;
          if (result.error) errors.push(result.error);
        }
      }

      return NextResponse.json({ sent, failed, errors, total: candidateIds.length });
    }

    // Single send
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId or candidateIds required" }, { status: 400 });
    }

    const result = await sendToCandidate(supabase, candidateId, templateId, channel || "email", variables || {}, customSubject, customBody);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ status: "sent" });
  } catch (error) {
    console.error("Messages Send: Unhandled error", { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
