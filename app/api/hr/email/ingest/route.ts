import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMessages, getMessage, markAsRead, ParsedEmail } from "@/lib/gmail/reader";
import {
  findReportAttachmentMeta,
  loadReportAttachment,
  extractDocxText,
} from "@/lib/gmail/report-attachments";
import { classifyEmail, categoryToRoute } from "@/lib/claude/classify-email";
import { requireApiAuth } from "@/lib/api/auth";
import { createAndProcessReport } from "@/lib/operations/report-intake";
import { loadContextBlock } from "@/lib/operations/context-loader";
import { withRunLog } from "@/lib/system/run-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

// Email queries — catch HR emails, daily reports, and operational updates
const HR_QUERIES = [
  "from:hr@blueprint-ph.com newer_than:7d",
  "to:hr@blueprint-ph.com newer_than:7d",
  "cc:hr@blueprint-ph.com newer_than:7d",
  "subject:(daily report OR consolidated OR דוח יומי) newer_than:7d",
  "from:blueprint.humanresources@gmail.com newer_than:7d",
  "to:blueprint.humanresources@gmail.com newer_than:7d",
];

const REPORT_SENDERS = ["hr@blueprint-ph.com", "blueprint.humanresources@gmail.com"];
const REPORT_SUBJECT_RE = /consolidated|daily report|weekly report|דוח יומי|דוח שבועי/i;

export async function GET(request: NextRequest) {
  // Cron jobs use CRON_SECRET bearer token, not user session.
  // Only fall back to requireApiAuth for manual browser calls.
  if (!authorized(request)) {
    const { error: authError } = await requireApiAuth({ permission: "view_emails" });
    if (authError) return authError;
  }

  const result = await withRunLog("email-ingest", async (log) => {
    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let reportsCreated = 0;

    // Learned knowledge improves classification of abbreviations/entities
    const contextBlock = await loadContextBlock();

    // 1. Collect messages from all HR queries (from, to, cc) and deduplicate
    const seenIds = new Set<string>();
    const messages: { id: string; threadId: string }[] = [];
    for (const query of HR_QUERIES) {
      const results = await listMessages(query, 30);
      for (const r of results) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          messages.push(r);
        }
      }
    }

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
            today,
            {
              contextBlock,
              attachmentNames: email.attachments.map((a) => a.filename),
            }
          );

          // If HR is involved (from/to/cc) but AI said "not_hr", override to "general_hr"
          const hrEmail = "hr@blueprint-ph.com";
          const hrInvolved =
            email.from.email.toLowerCase() === hrEmail ||
            (email.to || "").toLowerCase().includes(hrEmail);

          if (classification.category === "not_hr" && hrInvolved) {
            classification.category = "general_hr";
            classification.summary = `[HR involved] ${classification.summary}`;
          }

          // Belt-and-braces: a consolidated/daily-report email from HR with a
          // document attached is ALWAYS a daily/weekly operations report,
          // regardless of what the classifier said.
          const isKnownReport =
            REPORT_SENDERS.includes(email.from.email.toLowerCase()) &&
            REPORT_SUBJECT_RE.test(email.subject || "") &&
            !!findReportAttachmentMeta(email);
          if (
            isKnownReport &&
            classification.category !== "daily_operations_report" &&
            classification.category !== "weekly_operations_report"
          ) {
            classification.category = /weekly|שבועי/i.test(email.subject || "")
              ? "weekly_operations_report"
              : "daily_operations_report";
            classification.summary = `[forced: report sender+subject+attachment] ${classification.summary}`;
          }

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
            const routed = await routeToModule(
              supabase,
              classification,
              emailRecord.id,
              today,
              email
            );

            if (routed.error) {
              await supabase
                .from("hr_emails")
                .update({
                  processing_status: "failed",
                  processing_error: routed.error,
                })
                .eq("id", emailRecord.id);
              failed++;
            } else if (routed.recordId) {
              if (routed.isReport) reportsCreated++;
              await supabase
                .from("hr_emails")
                .update({
                  routed_record_id: routed.recordId,
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
          failed++;
        }

        // 8. Mark as read in Gmail
        await markAsRead(email.messageId);
        processed++;
        log.addItems(1);
      } catch (msgError) {
        console.error(`Failed to process message ${msg.id}:`, msgError);
        failed++;
      }
    }

    log.setDetail("processed", processed);
    log.setDetail("skipped", skipped);
    log.setDetail("failed", failed);
    log.setDetail("reports_created", reportsCreated);

    return { processed, skipped, failed, reports_created: reportsCreated };
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Email ingestion failed", detail: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    ...result.value,
    timestamp: new Date().toISOString(),
  });
}

export const POST = GET;

// ---------------------------------------------------------------------------
// Route classified email to the appropriate HR module
// ---------------------------------------------------------------------------

interface RouteResult {
  recordId: string | null;
  isReport?: boolean;
  error?: string;
}

/**
 * Creates an op_reports row from an email — downloading and parsing the
 * PDF/DOCX attachment when present, so the actual report content (not just
 * the email body) reaches the extraction pipeline. The row is queued; the
 * process-queued cron runs the AI extraction.
 */
async function createReportFromEmail(
  classification: Awaited<ReturnType<typeof classifyEmail>>,
  emailId: string,
  email: ParsedEmail,
  reportDate: string,
  extraMeta: Record<string, unknown> = {}
): Promise<RouteResult> {
  const attachment = await loadReportAttachment(email);

  let rawText = email.bodyText || classification.summary || "";
  let pdfBuffer: Buffer | undefined;
  if (attachment?.kind === "docx") {
    const docxText = await extractDocxText(attachment.buffer);
    if (docxText.trim()) rawText = docxText;
  } else if (attachment?.kind === "pdf") {
    pdfBuffer = attachment.buffer;
    rawText = ""; // let the intake pipeline extract text from the PDF itself
  }

  const intake = await createAndProcessReport({
    rawText,
    pdfBuffer,
    sourceType: "email",
    reportDate,
    sourceMeta: {
      email_id: emailId,
      gmail_message_id: email.messageId,
      subject: email.subject,
      from_email: email.from.email,
      from_name: email.from.name,
      attachment_filename: attachment?.filename || null,
      email_body_text: (email.bodyText || "").slice(0, 5000),
      classification_category: classification.category,
      classification_confidence: classification.confidence,
      ...extraMeta,
    },
    processNow: false,
  });

  if (!intake.ok) {
    return { recordId: null, error: intake.error || "Failed to create report from email" };
  }
  return { recordId: intake.reportId, isReport: true };
}

async function routeToModule(
  supabase: ReturnType<typeof createAdminClient>,
  classification: Awaited<ReturnType<typeof classifyEmail>>,
  emailId: string,
  today: string,
  email: ParsedEmail
): Promise<RouteResult> {
  const { category, extracted_data, employee_name, dates } = classification;
  const receivedDate = email.receivedAt.toISOString().slice(0, 10);

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
      if (!employeeId) return { recordId: null };
      const leaveType = category === "sick_day" ? "sick" : (extracted_data.leave_type as string) || "vacation";
      const startDate = dates?.start || dates?.single || today;
      const endDate = dates?.end || startDate;
      const daysCount = extracted_data.days_count as number ||
        Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

      const { data, error } = await supabase
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
      if (error) return { recordId: null, error: error.message };
      return { recordId: data?.id || null };
    }

    case "attendance_report": {
      return createReportFromEmail(
        classification,
        emailId,
        email,
        dates?.single || receivedDate
      );
    }

    case "general_hr":
    case "employee_update": {
      // Store as an HR document note linked to employee if matched
      const { data: hrDoc, error } = await supabase.from("hr_employee_documents").insert({
        employee_id: employeeId,
        document_type: "memo",
        title: email.subject || classification.summary?.slice(0, 100) || "Email note",
        storage_path: `email://${email.messageId}`,
        notes: `Auto-filed from email (${category}): ${classification.summary || ""}`.slice(0, 500),
      }).select("id").single();
      if (error) return { recordId: null, error: error.message };
      return { recordId: hrDoc?.id || null };
    }

    case "equipment_request": {
      // Create an HR document for tracking
      const { data: eqDoc, error } = await supabase.from("hr_employee_documents").insert({
        employee_id: employeeId,
        document_type: "memo",
        title: `Equipment Request: ${email.subject || ""}`.slice(0, 200),
        storage_path: `email://${email.messageId}`,
        notes: `Auto-filed from email: ${classification.summary || ""}`.slice(0, 500),
      }).select("id").single();
      if (error) return { recordId: null, error: error.message };
      return { recordId: eqDoc?.id || null };
    }

    case "onboarding_task": {
      if (!employeeId) return { recordId: null };
      const { data, error } = await supabase
        .from("hr_onboarding_tasks")
        .insert({
          employee_id: employeeId,
          process_type: "onboarding",
          task: classification.summary,
          status: "pending",
          due_date: dates?.single || dates?.start || null,
          notes: `Auto-created from email: ${classification.summary}`,
        })
        .select("id")
        .single();
      if (error) return { recordId: null, error: error.message };
      return { recordId: data?.id || null };
    }

    case "offboarding_task": {
      if (!employeeId) return { recordId: null };
      const { data, error } = await supabase
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
      if (error) return { recordId: null, error: error.message };
      return { recordId: data?.id || null };
    }

    case "daily_operations_report":
    case "weekly_operations_report": {
      return createReportFromEmail(
        classification,
        emailId,
        email,
        dates?.single || receivedDate
      );
    }

    case "project_update": {
      return createReportFromEmail(
        classification,
        emailId,
        email,
        dates?.single || receivedDate,
        { project_hint: (extracted_data.project_name as string) || null }
      );
    }

    case "safety_incident": {
      return createReportFromEmail(
        classification,
        emailId,
        email,
        dates?.single || receivedDate,
        {
          incident_type: (extracted_data.incident_type as string) || null,
          severity: (extracted_data.severity as string) || null,
        }
      );
    }

    default:
      return { recordId: null };
  }
}
