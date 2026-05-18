import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.answer_text) {
    return NextResponse.json({ error: "answer_text required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch the question
  const { data: question, error: fetchErr } = await supabase
    .from("op_context_questions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  if (question.status !== "pending") {
    return NextResponse.json({ error: "Question already resolved" }, { status: 409 });
  }

  // Create a context entry from the answer
  const { data: entry, error: insertErr } = await supabase
    .from("op_context_entries")
    .insert({
      entry_type: question.suggested_type || "general",
      trigger_text: question.suggested_trigger || question.question_text.slice(0, 100),
      resolution: String(body.answer_text).trim(),
      source: "question_answer",
      source_draft_id: question.draft_id,
      confidence: 1.0,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Update the question as answered
  const { error: updateErr } = await supabase
    .from("op_context_questions")
    .update({
      answer_text: String(body.answer_text).trim(),
      resolved_context_entry_id: entry.id,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ entry, question_id: id });
}
