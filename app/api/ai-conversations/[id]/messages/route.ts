import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET - get all messages for a conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST - add a message to a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: params.id,
        role: body.role,
        content: body.content,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update conversation timestamp and title
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.role === "user" && body.isFirst) {
      updates.title = body.content.slice(0, 80);
    }
    await supabase
      .from("ai_conversations")
      .update(updates)
      .eq("id", params.id);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
