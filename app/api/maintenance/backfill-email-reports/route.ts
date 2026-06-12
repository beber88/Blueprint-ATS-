import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMessage } from "@/lib/gmail/reader";
import {
  loadReportAttachment,
  extractDocxText,
} from "@/lib/gmail/report-attachments";
import { createAndProcessReport } from "@/lib/operations/report-intake";
import { requireApiAuth } from "@/lib/api/auth";
import { withRunLog } from "@/lib/system/run-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPORT_CATEGORIES = [
  "daily_operations_report",
  "weekly_operations_report",
  "attendance_report",
  "project_update",
  "safety_incident",
];

/**
 * POST /api/maintenance/backfill-email-reports?days=30
 *
 * One-time recovery for report emails whose content was lost before the
 * attachment-aware pipeline existed: emails stuck in "classified" (their
 * op_reports insert silently failed) and email reports whose extraction
 * produced zero items because the PDF was never read. Re-fetches the
 * original Gmail message, downloads the attachment, deletes the empty
 * report row if one exists, and queues a fresh report for extraction.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearerOk =
    !!cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!bearerOk) {
    const { error: authError } = await requireApiAuth({ minimumRole: "admin" });
    if (authError) return authError;
  }

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30"), 1), 90);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const result = await withRunLog("backfill-email-reports", async (log) => {
    const supabase = createAdminClient();

    const { data: emails, error } = await supabase
      .from("hr_emails")
      .select("id, gmail_message_id, subject, from_email, from_name, body_text, received_at, classification, routed_record_id, processing_status")
      .gte("received_at", since)
      .in("processing_status", ["classified", "routed", "failed"]);

    if (error) throw new Error(`failed to list emails: ${error.message}`);

    let recovered = 0;
    let skipped = 0;
    let failed = 0;
    const details: { email: string; outcome: string }[] = [];

    for (const em of emails || []) {
      const category = (em.classification as Record<string, unknown> | null)?.category;
      if (!REPORT_CATEGORIES.includes(String(category))) {
        continue;
      }

      try {
        // Does this email already have a report with extracted items?
        const { data: existingReports } = await supabase
          .from("op_reports")
          .select("id, raw_text, processing_status")
          .eq("source_meta->>email_id", em.id);

        let existingWithItems = false;
        const emptyReportIds: string[] = [];
        for (const rep of existingReports || []) {
          const { count } = await supabase
            .from("op_report_items")
            .select("id", { count: "exact", head: true })
            .eq("report_id", rep.id);
          if ((count || 0) > 0) existingWithItems = true;
          else if (rep.processing_status !== "queued") emptyReportIds.push(rep.id);
        }

        if (existingWithItems) {
          skipped++;
          continue;
        }

        // Re-fetch the original message and pull the attachment
        const email = await getMessage(em.gmail_message_id);
        const attachment = await loadReportAttachment(email);

        let rawText = email.bodyText || em.body_text || "";
        let pdfBuffer: Buffer | undefined;
        if (attachment?.kind === "docx") {
          const docxText = await extractDocxText(attachment.buffer);
          if (docxText.trim()) rawText = docxText;
        } else if (attachment?.kind === "pdf") {
          pdfBuffer = attachment.buffer;
          rawText = "";
        }

        if (!pdfBuffer && rawText.trim().length < 30) {
          skipped++;
          details.push({ email: em.subject || em.id, outcome: "no_content" });
          continue;
        }

        // Remove the old empty report rows (they hold no items)
        if (emptyReportIds.length > 0) {
          await supabase.from("op_reports").delete().in("id", emptyReportIds);
        }

        const intake = await createAndProcessReport({
          rawText,
          pdfBuffer,
          sourceType: "email",
          reportDate: em.received_at?.slice(0, 10) || null,
          sourceMeta: {
            email_id: em.id,
            gmail_message_id: em.gmail_message_id,
            subject: em.subject,
            from_email: em.from_email,
            from_name: em.from_name,
            attachment_filename: attachment?.filename || null,
            classification_category: category,
            backfilled: true,
          },
          processNow: false,
        });

        if (!intake.ok) {
          failed++;
          details.push({ email: em.subject || em.id, outcome: intake.error || "failed" });
          continue;
        }

        await supabase
          .from("hr_emails")
          .update({ routed_record_id: intake.reportId, processing_status: "routed" })
          .eq("id", em.id);

        recovered++;
        log.addItems(1);
        details.push({ email: em.subject || em.id, outcome: "queued" });
      } catch (err) {
        failed++;
        details.push({
          email: em.subject || em.id,
          outcome: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log.setDetail("recovered", recovered);
    log.setDetail("skipped", skipped);
    log.setDetail("failed", failed);

    return { recovered, skipped, failed, details };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}

export const GET = POST;
