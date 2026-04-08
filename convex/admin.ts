import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════
// USER PROFILES
// ═══════════════════════════════════

export const getCurrentUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return null;
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId!))
      .first();
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userProfiles").order("asc").collect();
  },
});

export const updateUser = mutation({
  args: {
    id: v.id("userProfiles"),
    full_name: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return id;
  },
});

export const deleteUser = mutation({
  args: { id: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const createUserProfile = mutation({
  args: {
    user_id: v.string(),
    email: v.string(),
    full_name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if profile already exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        full_name: args.full_name || existing.full_name,
        avatar_url: args.avatar_url || existing.avatar_url,
        updated_at: Date.now(),
      });
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      user_id: args.user_id,
      email: args.email,
      full_name: args.full_name,
      avatar_url: args.avatar_url,
      role: args.role || "user",
      phone: args.phone,
      created_at: now,
      updated_at: now,
    });
  },
});

// ═══════════════════════════════════
// JOB CATEGORIES
// ═══════════════════════════════════

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jobCategories")
      .withIndex("by_sort_order")
      .collect();
  },
});

export const createCategory = mutation({
  args: {
    key: v.string(),
    name_en: v.string(),
    name_he: v.string(),
    name_tl: v.optional(v.string()),
    sort_order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobCategories", {
      ...args,
      is_active: true,
    });
  },
});
