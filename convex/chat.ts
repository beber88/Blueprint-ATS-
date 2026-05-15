import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const listConversations = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    if (!args.userId) return [];

    const participations = await ctx.db
      .query("chatParticipants")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId!))
      .collect();

    const conversations = await Promise.all(
      participations.map(async (p) => {
        const conv = await ctx.db.get(p.conversation_id);
        if (!conv) return null;

        // Get last message
        const lastMessage = await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversation_id", p.conversation_id))
          .order("desc")
          .first();

        // Get participants
        const participants = await ctx.db
          .query("chatParticipants")
          .withIndex("by_conversation", (q) => q.eq("conversation_id", p.conversation_id))
          .collect();

        return {
          ...conv,
          lastMessage,
          participants,
          last_read_at: p.last_read_at,
        };
      })
    );

    return conversations
      .filter(Boolean)
      .sort((a, b) => (b!.updated_at || 0) - (a!.updated_at || 0));
  },
});

export const getMessages = query({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversation_id", args.conversationId))
      .order("asc")
      .collect();
  },
});

export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    participantIds: v.array(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const now = Date.now();
    const convId = await ctx.db.insert("chatConversations", {
      title: args.title,
      created_by: args.createdBy,
      created_at: now,
      updated_at: now,
    });

    // Add participants
    for (const userId of args.participantIds) {
      await ctx.db.insert("chatParticipants", {
        conversation_id: convId,
        user_id: userId,
        joined_at: now,
      });
    }

    return convId;
  },
});

export const sendChatMessage = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    senderId: v.string(),
    senderName: v.optional(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const now = Date.now();

    const msgId = await ctx.db.insert("chatMessages", {
      conversation_id: args.conversationId,
      sender_id: args.senderId,
      sender_name: args.senderName,
      content: args.content,
      created_at: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, { updated_at: now });

    return msgId;
  },
});

export const markRead = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const participant = await ctx.db
      .query("chatParticipants")
      .withIndex("by_conversation", (q) => q.eq("conversation_id", args.conversationId))
      .filter((q) => q.eq(q.field("user_id"), args.userId))
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, { last_read_at: Date.now() });
    }
  },
});
