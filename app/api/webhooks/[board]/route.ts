import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { board: string } }) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const board = params.board;

    console.log(`Webhook from ${board}:`, JSON.stringify(body).slice(0, 500));

    // Extract candidate info based on board format
    let candidateName = "";
    let candidateEmail = "";
    let jobId = "";

    if (board === "jobstreet") {
      candidateName = body.applicant?.name || body.name || "";
      candidateEmail = body.applicant?.email || body.email || "";
      jobId = body.job_id || body.advertisement_id || "";
    } else if (board === "indeed") {
      candidateName = body.candidate?.name || body.name || "";
      candidateEmail = body.candidate?.email || body.email || "";
      jobId = body.job?.id || "";
    } else if (board === "kalibrr") {
      candidateName = body.applicant_name || "";
      candidateEmail = body.applicant_email || "";
      jobId = body.job_id || "";
    } else {
      candidateName = body.name || body.full_name || "";
      candidateEmail = body.email || "";
    }

    if (!candidateName && !candidateEmail) {
      return NextResponse.json({ error: "No candidate data" }, { status: 400 });
    }

    // Check for duplicates
    if (candidateEmail) {
      const { data: existing } = await supabase.from("candidates").select("id").eq("email", candidateEmail).single();
      if (existing) {
        // Record application from this board
        await supabase.from("job_board_applications").insert({
          candidate_id: existing.id,
          job_id: jobId || null,
          board,
          raw_data: body,
        });
        return NextResponse.json({ status: "duplicate", candidate_id: existing.id });
      }
    }

    // Create new candidate
    const { data: candidate } = await supabase.from("candidates").insert({
      full_name: candidateName,
      email: candidateEmail || null,
      source: board,
      status: "new",
    }).select().single();

    if (candidate) {
      await supabase.from("job_board_applications").insert({
        candidate_id: candidate.id,
        job_id: jobId || null,
        board,
        raw_data: body,
      });

      await supabase.from("activity_log").insert({
        candidate_id: candidate.id,
        action: "candidate_created",
        details: { source: board, board_data: true },
      });
    }

    return NextResponse.json({ status: "created", candidate_id: candidate?.id });
  } catch (error) {
    console.error(`Webhook ${params.board} error:`, error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
