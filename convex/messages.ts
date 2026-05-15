import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { requireModule, requireWriteAccess, requireAuth } from "./lib/auth";

// ═══════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireModule(ctx, "recruitment");
    return await ctx.db.query("messageTemplates").order("desc").collect();
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.string(),
    variables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    return await ctx.db.insert("messageTemplates", {
      ...args,
      created_at: Date.now(),
    });
  },
});

// ═══════════════════════════════════
// SENT MESSAGES
// ═══════════════════════════════════

export const listSent = query({
  args: {},
  handler: async (ctx) => {
    await requireModule(ctx, "recruitment");
    const messages = await ctx.db.query("messagesSent").order("desc").take(100);

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const candidate = await ctx.db.get(msg.candidate_id);
        const template = msg.template_id ? await ctx.db.get(msg.template_id) : null;
        return { ...msg, candidate, template };
      })
    );

    return enriched;
  },
});

export const sendMessage = action({
  args: {
    candidate_id: v.id("candidates"),
    template_id: v.optional(v.id("messageTemplates")),
    channel: v.string(),
    to_address: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    // TODO: Integrate actual email/WhatsApp sending (Gmail API, Twilio)
    // For now, just log the message

    await ctx.runMutation(api.messages.recordSent, {
      candidate_id: args.candidate_id,
      template_id: args.template_id,
      channel: args.channel,
      to_address: args.to_address,
      subject: args.subject,
      body: args.body,
    });

    return { success: true };
  },
});

export const recordSent = mutation({
  args: {
    candidate_id: v.id("candidates"),
    template_id: v.optional(v.id("messageTemplates")),
    channel: v.string(),
    to_address: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    const id = await ctx.db.insert("messagesSent", {
      ...args,
      status: "sent",
      sent_at: Date.now(),
    });

    // Update candidate contact status
    await ctx.db.patch(args.candidate_id, {
      contact_status: "contacted",
      last_contacted_at: Date.now(),
      updated_at: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      candidate_id: args.candidate_id,
      action: "message_sent",
      details: { channel: args.channel },
      created_at: Date.now(),
    });

    return id;
  },
});
