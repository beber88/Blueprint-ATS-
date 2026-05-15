import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get("entity_type");
    const entity_id = searchParams.get("entity_id");

    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: "entity_type and entity_id are required" }, { status: 400 });
    }

    // Look for existing conversation with matching context
    const { data: existing } = await admin
      .from("chat_conversations")
      .select("*")
      .eq("context_entity_type", entity_type)
      .eq("context_entity_id", entity_id)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ conversation: existing, existing: true });
    }

    // Create a new context conversation
    const { data: conv, error } = await admin
      .from("chat_conversations")
      .insert({
        type: "context",
        module: "operations",
        context_entity_type: entity_type,
        context_entity_id: entity_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add the current user as a participant
    await admin.from("chat_participants").insert({
      conversation_id: conv.id,
      user_id: user.id,
    });

    return NextResponse.json({ conversation: conv, existing: false });
  } catch (error) {
    console.error("Chat by-context error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
