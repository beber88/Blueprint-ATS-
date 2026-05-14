import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMessages, getMessage, markAsRead } from "@/lib/gmail/reader";
import { classifyEmail, categoryToRoute } from "@/lib/claude/classify-email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

// HR manager email filter — match emails from Nicx
const HR_SENDER_QUERY = "from:nicx is:unread newer_than:1d";

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // 1. List unread messages from HR manager
    const messages = await listMessages(HR_SENDER_QUERY, 20);

    for (const msg of messages) {
      try {
        // 2. Check if already ingested
        const { data: existing } = await supabase
          .from("hr_emails")
          .select("id")
          .eq("gmail_message_id", msg.id)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // 3. Fetch full message
        const email = await getMessage(msg.id);

        // 4. Store raw email
        const { data: emailRecord, error: insertError } = await supabase
          .from("hr_emails")
          .insert({
            gmail_message_id: email.messageId,
            thread_id: email.threadId,
            from_email: email.from.email,
            from_name: email.from.name,
            to_email: email.to,
            subject: email.subject,
            body_text: email.bodyText,
            body_html: email.bodyHtml,
            attachments: email.attachments.map((a) => ({
              filename: a.filename,
              mimeType: a.mimeType,
              size: a.size,
            })),
            received_at: email.receivedAt.toISOString(),
            processing_status: "pending",
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to insert email:", insertError.message);
          failed++;
          continue;
        }

        // 5. Classify with AI
        try {
          const classification = await classifyEmail(
            email.subject,
            email.bodyText,
            email.from.name,
            today
          );

          const routedTo = categoryToRoute(classification.category);

          // 6. Update email record with classification
          await supabase
            .from("hr_emails")
            .update({
              classification,
              routed_to: routedTo,
              processing_status: routedTo ? "classified" : "ignored",
            })
            .eq("id", emailRecord.id);

          // 7. Auto-route to the appropriate module
          if (routedTo) {
            const routedRecordId = await routeToModule(
              supabase,
              classification,
              emailRecord.id,
              today
            );

            if (routedRecordId) {
              await supabase
                .from("hr_emails")
                .update({
                  routed_record_id: routedRecordId,
                  processing_status: "routed",
                })
                .eq("id", emailRecord.id);
            }
          }
        } catch (classifyError) {
          console.error("Classification failed:", classifyError);
          await supabase
            .from("hr_emails")
            .update({
              processing_status: "failed",
              processing_error: classifyError instanceof Error ? classifyError.message : "Classification failed",
            })
            .eq("id", emailRecord.id);
        }

        // 8. Mark as read in Gmail
        await markAsRead(email.messageId);
        processed++;
      } catch (msgError) {
        console.error(`Failed to process message ${msg.id}:`, msgError);
        failed++;
      }
    }
  } catch (error) {
    console.error("Email ingestion failed:", error);
    return NextResponse.json(
      { error: "Email ingestion failed", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    failed,
    timestamp: new Date().toISOString(),
  });
}

export const POST = GET;

// ---------------------------------------------------------------------------
// Route classified email to the appropriate HR module
// ---------------------------------------------------------------------------

async function routeToModule(
  supabase: ReturnType<typeof createAdminClient>,
  classification: Awaited<ReturnType<typeof classifyEmail>>,
  emailId: string,
  today: string
): Promise<string | null> {
  const { category, extracted_data, employee_name, dates } = classification;

  // Try to find employee by name
  let employeeId: string | null = null;
  if (employee_name) {
    const { data: emp } = await supabase
      .from("op_employees")
      .select("id")
      .ilike("full_name", `%${employee_name}%`)
      .eq("is_active", true)
      .maybeSingle();
    employeeId = emp?.id || null;
  }

  switch (category) {
    case "leave_request":
    case "sick_day": {
      if (!employeeId) return null;
      const leaveType = category === "sick_day" ? "sick" : (extracted_data.leave_type as string) || "vacation";
      const startDate = dates?.start || dates?.single || today;
      const endDate = dates?.end || startDate;
      const daysCount = extracted_data.days_count as number ||
        Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

      const { data } = await supabase
        .from("hr_leave_requests")
        .insert({
          employee_id: employeeId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          days_count: daysCount,
          reason: extracted_data.reason as string || classification.summary,
          status: "pending",
          source: "email",
          source_email_id: emailId,
        })
        .select("id")
        .single();
      return data?.id || null;
    }

    case "attendance_report": {
      // Store as a general record — the attendance page will show it
      return null;
    }

    case "equipment_request": {
      if (!employeeId) return null;
      // Create asset request note — will appear in the assets module
      return null;
    }

    case "onboarding_task": {
      const newEmployeeName = extracted_data.new_employee_name as string || employee_name;
      if (!newEmployeeName) return null;

      const { data } = await supabase
        .from("hr_onboarding_tasks")
        .insert({
          employee_id: employeeId || "00000000-0000-0000-0000-000000000000",
          process_type: "onboarding",
          task: classification.summary,
          status: "pending",
          due_date: dates?.single || dates?.start || null,
          notes: `Auto-created from email: ${classification.summary}`,
        })
        .select("id")
        .single();
      return data?.id || null;
    }

    case "offboarding_task": {
      if (!employeeId) return null;
      const { data } = await supabase
        .from("hr_onboarding_tasks")
        .insert({
          employee_id: employeeId,
          process_type: "offboarding",
          task: classification.summary,
          status: "pending",
          due_date: dates?.single || dates?.start || null,
          notes: `Auto-created from email: ${classification.summary}`,
        })
        .select("id")
        .single();
      return data?.id || null;
    }

    default:
      return null;
  }
}
