import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: messages } = await admin
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", params.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);

    // Get sender profiles
    const senderIds = Array.from(new Set((messages || []).map(m => m.sender_id).filter(Boolean)));
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", senderIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    const enriched = (messages || []).map(m => ({ ...m, sender: profileMap[m.sender_id] || null }));

    // Update last_read_at
    await admin
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", params.id)
      .eq("user_id", user.id);

    return NextResponse.json({ messages: enriched });
  } catch (error) {
    console.error("Chat messages error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const body = await request.json();

    const { data: message, error } = await admin.from("chat_messages").insert({
      conversation_id: params.id,
      sender_id: user.id,
      content: body.content,
      message_type: body.message_type || "text",
      shared_candidate_id: body.shared_candidate_id || null,
      shared_file_id: body.shared_file_id || null,
      shared_data: body.shared_data || {},
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update conversation timestamp
    await admin.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", params.id);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
