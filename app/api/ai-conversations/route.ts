import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET - list all conversations
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*, ai_messages(id, role, content, created_at)")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add preview (first user message) and message count
    const conversations = (data || []).map(conv => {
      const messages = conv.ai_messages || [];
      const firstUserMsg = messages.find((m: { role: string }) => m.role === "user");
      return {
        id: conv.id,
        title: conv.title || (firstUserMsg?.content?.slice(0, 60) + "...") || "שיחה חדשה",
        mode: conv.mode,
        candidate_ids: conv.candidate_ids,
        message_count: messages.length,
        preview: firstUserMsg?.content?.slice(0, 100) || "",
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST - create new conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        title: body.title || null,
        mode: body.mode || "general",
        candidate_ids: body.candidate_ids || [],
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE - delete a conversation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { id } = await request.json();

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { error } = await supabase
      .from("ai_conversations")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
