import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    // Get conversations where user is a participant
    const { data: participations } = await admin
      .from("chat_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (!participations || participations.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const convIds = participations.map(p => p.conversation_id);

    // Get conversations with participants
    const { data: conversations } = await admin
      .from("chat_conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    // For each conversation, get participants and last message
    const result = await Promise.all((conversations || []).map(async (conv) => {
      const { data: participants } = await admin
        .from("chat_participants")
        .select("user_id")
        .eq("conversation_id", conv.id);

      const participantIds = (participants || []).map(p => p.user_id);
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", participantIds);

      const { data: lastMessages } = await admin
        .from("chat_messages")
        .select("content, message_type, sender_id, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const myParticipation = participations.find(p => p.conversation_id === conv.id);
      const { count: unreadCount } = await admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", user.id)
        .gt("created_at", myParticipation?.last_read_at || "1970-01-01");

      return {
        ...conv,
        participants: profiles || [],
        lastMessage: lastMessages?.[0] || null,
        unreadCount: unreadCount || 0,
      };
    }));

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error("Chat conversations error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { type, participant_ids, name } = await request.json();

    if (type === "direct" && participant_ids?.length === 1) {
      // Check for existing direct conversation
      const otherId = participant_ids[0];
      const { data: myConvs } = await admin
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myConvs) {
        for (const mc of myConvs) {
          const { data: conv } = await admin
            .from("chat_conversations")
            .select("id, type")
            .eq("id", mc.conversation_id)
            .eq("type", "direct")
            .single();

          if (conv) {
            const { data: otherPart } = await admin
              .from("chat_participants")
              .select("user_id")
              .eq("conversation_id", conv.id)
              .eq("user_id", otherId)
              .single();

            if (otherPart) {
              return NextResponse.json({ conversation: conv, existing: true });
            }
          }
        }
      }
    }

    // Create new conversation
    const { data: conv, error } = await admin
      .from("chat_conversations")
      .insert({ type, name: name || null, created_by: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add participants
    const allParticipants = [user.id, ...(participant_ids || [])];
    const uniqueParticipants = Array.from(new Set(allParticipants));

    for (const pid of uniqueParticipants) {
      await admin.from("chat_participants").insert({
        conversation_id: conv.id,
        user_id: pid,
      });
    }

    return NextResponse.json({ conversation: conv });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
