import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/gmail/client";
import { sendWhatsApp } from "@/lib/twilio/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { candidateId, templateId, channel, variables, customSubject, customBody } = body;

    // Fetch candidate
    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    let subject = customSubject || "";
    let messageBody = customBody || "";

    // If using template, fetch and fill variables
    if (templateId) {
      const { data: template } = await supabase
        .from("message_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (template) {
        subject = template.subject || "";
        messageBody = template.body;

        // Replace variables
        const vars = { candidate_name: candidate.full_name, ...variables };
        for (const [key, value] of Object.entries(vars)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          subject = subject.replace(regex, String(value));
          messageBody = messageBody.replace(regex, String(value));
        }
      }
    }

    let status = "sent";
    const toAddress = channel === "email" ? candidate.email : candidate.phone;

    if (!toAddress) {
      return NextResponse.json(
        { error: `Candidate has no ${channel === "email" ? "email" : "phone number"}` },
        { status: 400 }
      );
    }

    // Validate email format
    if (channel === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(toAddress)) {
        return NextResponse.json(
          { error: "Invalid email address format" },
          { status: 400 }
        );
      }
    }

    // Validate phone number (must contain at least 7 digits)
    if (channel === "whatsapp") {
      const digitCount = (toAddress.match(/\d/g) || []).length;
      if (digitCount < 7) {
        return NextResponse.json(
          { error: "Invalid phone number: must contain at least 7 digits" },
          { status: 400 }
        );
      }
    }

    try {
      if (channel === "email") {
        await sendEmail(toAddress, subject, messageBody);
      } else if (channel === "whatsapp") {
        await sendWhatsApp(toAddress, messageBody);
      }
    } catch (sendError) {
      console.error("Send error:", sendError);
      status = "failed";

      // Log failed message
      await supabase.from("messages_sent").insert({
        candidate_id: candidateId,
        template_id: templateId || null,
        channel,
        to_address: toAddress,
        subject,
        body: messageBody,
        status: "failed",
      });

      const errorMsg = sendError instanceof Error ? sendError.message : "Failed to send message";
      return NextResponse.json({ error: errorMsg, status: "failed" }, { status: 500 });
    }

    // Log message
    const { data: sentMessage, error: logError } = await supabase
      .from("messages_sent")
      .insert({
        candidate_id: candidateId,
        template_id: templateId || null,
        channel,
        to_address: toAddress,
        subject,
        body: messageBody,
        status,
      })
      .select()
      .single();

    if (logError) {
      console.error("Log error:", logError);
    }

    // Activity log
    await supabase.from("activity_log").insert({
      candidate_id: candidateId,
      action: `message_${status}`,
      details: { channel, template_id: templateId },
    });

    return NextResponse.json({ message: sentMessage, status });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
