import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitReports } from "@/lib/operations/bulk-split";
import {
  BULK_IMPORT_CONCURRENCY,
  BULK_IMPORT_MAX_REPORTS,
  DEDUP_WINDOW_HOURS,
  hashSourceText,
} from "@/lib/operations/bulk-import";
import { estimateBulkCost } from "@/lib/operations/bulk-cost";
import { extractReportItems } from "@/lib/claude/extract-report";
import { computeWarnings } from "@/lib/operations/draft-warnings";
import { loadMasterSnapshot } from "@/lib/operations/draft-master-snapshot";
import { promoteDraft } from "@/lib/operations/draft-promote";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RunBody {
  text: string;
  defaultProjectId?: string;
  force?: boolean;
  expectedReports?: number;
  // Auto-promote drafts with zero high-severity warnings to op_reports
  // without human review. Drafts WITH high warnings stay as `flagged`.
  autoPromote?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }
    const body = (await request.json()) as RunBody;
    if (!body.text || body.text.trim().length < 100) {
      return NextResponse.json(
        { error: "text required (min 100 chars)" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const chunks = splitReports(body.text);
    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not detect any report headers. Reports must contain a 'Date: YYYY-MM-DD' or 'תאריך: ...' line.",
        },
        { status: 400 }
      );
    }
    if (chunks.length > BULK_IMPORT_MAX_REPORTS) {
      return NextResponse.json(
        {
          error: `Batch contains ${chunks.length} reports — exceeds cap of ${BULK_IMPORT_MAX_REPORTS}.`,
          detectedReports: chunks.length,
          cap: BULK_IMPORT_MAX_REPORTS,
        },
        { status: 422 }
      );
    }

    const sourceTextHash = hashSourceText(body.text);
    const cost = estimateBulkCost(body.text, chunks.length);

    if (!body.force) {
      const since = new Date(
        Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();
      const { data: prior } = await supabase
        .from("op_bulk_import_jobs")
        .select("id, created_at")
        .eq("source_text_hash", sourceTextHash)
        .eq("status", "done")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prior) {
        return NextResponse.json(
          {
            error: `Identical batch was already processed at ${prior.created_at}. Resume that job or pass force=true.`,
            duplicateJobId: prior.id,
            duplicateJobCreatedAt: prior.created_at,
          },
          { status: 409 }
        );
      }
    }

    // 1. Create the job.
    const { data: job, error: jobErr } = await supabase
      .from("op_bulk_import_jobs")
      .insert({
        total_reports: chunks.length,
        status: "running",
        source_text_hash: sourceTextHash,
        estimated_input_tokens: cost.inputTokens,
        estimated_output_tokens: cost.outputTokens,
        estimated_cost_usd: cost.costUsd,
        auto_promote: !!body.autoPromote,
      })
      .select()
      .single();
    if (jobErr || !job) {
      return NextResponse.json(
        { error: `failed to create job: ${jobErr?.message}` },
        { status: 500 }
      );
    }

    // 2. Create one item per detected chunk.
    const itemRows = chunks.map((c, i) => ({
      job_id: job.id,
      report_index: i,
      date_extracted: c.date,
      status: "pending" as const,
    }));
    const { data: items, error: itemsErr } = await supabase
      .from("op_bulk_import_items")
      .insert(itemRows)
      .select();
    if (itemsErr || !items) {
      await supabase
        .from("op_bulk_import_jobs")
        .update({ status: "failed", notes: itemsErr?.message })
        .eq("id", job.id);
      return NextResponse.json(
        { error: `failed to create items: ${itemsErr?.message}` },
        { status: 500 }
      );
    }

    // Load master snapshot ONCE — used by every chunk's computeWarnings.
    const snapshot = await loadMasterSnapshot(supabase);

    // 3. Process items with bounded concurrency.
    const limit = pLimit(BULK_IMPORT_CONCURRENCY);
    const itemById = new Map(items.map((it) => [it.report_index, it]));

    await Promise.all(
      chunks.map((c, i) =>
        limit(async () => {
          const item = itemById.get(i);
          if (!item) return;

          // Re-check job status before doing real work.
          const { data: latest } = await supabase
            .from("op_bulk_import_jobs")
            .select("status, auto_promote")
            .eq("id", job.id)
            .single();
          if (latest?.status === "cancelled") {
            await supabase
              .from("op_bulk_import_items")
              .update({ status: "cancelled" })
              .eq("id", item.id)
              .eq("status", "pending");
            return;
          }

          await supabase
            .from("op_bulk_import_items")
            .update({ status: "processing" })
            .eq("id", item.id);

          try {
            const reportDate = c.date || new Date().toISOString().slice(0, 10);
            const extracted = await extractReportItems(c.chunk, { reportDate });
            const aiOutput = {
              report_date: reportDate,
              project_id: body.defaultProjectId || null,
              confidence: extracted.confidence,
              model: extracted.model,
              notes: extracted.notes,
              items: extracted.items,
              ceo_action_items: extracted.items.filter(
                (it) => it.ceo_decision_needed
              ),
            };
            const warnings = computeWarnings(aiOutput, snapshot);

            // Create the draft, linked to this bulk item.
            const { data: draft, error: dErr } = await supabase
              .from("op_report_drafts")
              .insert({
                source_text: c.chunk.slice(0, 200_000),
                ai_output_json: aiOutput,
                warnings_json: warnings,
                source_kind: "bulk",
                status: "draft",
                bulk_import_item_id: item.id,
              })
              .select()
              .single();
            if (dErr || !draft) {
              throw new Error(`failed to create draft: ${dErr?.message}`);
            }

            // Decide whether to auto-promote.
            const hasHigh = warnings.some((w) => w.severity === "high");
            let outputReportId: string | null = null;
            if (latest?.auto_promote && !hasHigh) {
              const result = await promoteDraft(supabase, draft, {
                extraReportMeta: {
                  bulk_import_job_id: job.id,
                  bulk_import_item_id: item.id,
                  auto_promoted: true,
                },
              });
              outputReportId = result.reportId;
            } else if (latest?.auto_promote && hasHigh) {
              // Auto-promote was requested but high warnings block it.
              // Mark the draft flagged so the operator sees it in the inbox.
              await supabase
                .from("op_report_drafts")
                .update({ status: "flagged", updated_at: new Date().toISOString() })
                .eq("id", draft.id);
            }

            await supabase
              .from("op_bulk_import_items")
              .update({
                status: "done",
                output_report_id: outputReportId,
                processed_at: new Date().toISOString(),
              })
              .eq("id", item.id);
          } catch (e) {
            await supabase
              .from("op_bulk_import_items")
              .update({
                status: "failed",
                error_message: e instanceof Error ? e.message : String(e),
                processed_at: new Date().toISOString(),
              })
              .eq("id", item.id);
          }
        })
      )
    );

    // 4. Finalize job status.
    const { data: counts } = await supabase
      .from("op_bulk_import_items")
      .select("status")
      .eq("job_id", job.id);
    const byStatus = (counts || []).reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    const { data: jobAfter } = await supabase
      .from("op_bulk_import_jobs")
      .select("status")
      .eq("id", job.id)
      .single();

    let finalStatus: "done" | "failed" | "cancelled" = "done";
    if (jobAfter?.status === "cancelled") finalStatus = "cancelled";
    else if (byStatus.failed && !byStatus.done) finalStatus = "failed";

    await supabase
      .from("op_bulk_import_jobs")
      .update({ status: finalStatus })
      .eq("id", job.id);

    return NextResponse.json({
      jobId: job.id,
      status: finalStatus,
      counts: byStatus,
      totalReports: chunks.length,
      autoPromote: !!body.autoPromote,
    });
  } catch (error) {
    console.error("bulk-import: unhandled", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "bulk import failed" },
      { status: 500 }
    );
  }
}
