import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireModule, requireWriteAccess } from "./lib/auth";

// ═══════════════════════════════════
// STORAGE
// ═══════════════════════════════════

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ═══════════════════════════════════
// FILE RECORDS
// ═══════════════════════════════════

export const getUnmatched = query({
  args: {},
  handler: async (ctx) => {
    await requireModule(ctx, "recruitment");
    const files = await ctx.db
      .query("candidateFiles")
      .withIndex("by_match_status", (q) => q.eq("match_status", "unmatched"))
      .collect();

    const candidates = await ctx.db.query("candidates").collect();
    const candidateList = candidates.map(c => ({
      id: c._id,
      full_name: c.full_name,
      email: c.email,
    }));

    return {
      files,
      candidates: candidateList,
    };
  },
});

export const assignFile = mutation({
  args: {
    fileId: v.id("candidateFiles"),
    candidateId: v.id("candidates"),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    await ctx.db.patch(args.fileId, {
      candidate_id: args.candidateId,
      match_status: "manual",
    });

    const file = await ctx.db.get(args.fileId);
    if (file) {
      const candidate = await ctx.db.get(args.candidateId);
      if (candidate) {
        const docs = candidate.documents || [];
        docs.push({
          name: file.file_name,
          url: file.file_url || "",
          type: file.file_type || "other",
          uploaded_at: new Date(file.created_at).toISOString(),
        });
        await ctx.db.patch(args.candidateId, { documents: docs, updated_at: Date.now() });
      }
    }

    return args.fileId;
  },
});

export const createFileRecord = mutation({
  args: {
    candidate_id: v.optional(v.id("candidates")),
    file_name: v.string(),
    file_url: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    file_type: v.optional(v.string()),
    file_size: v.optional(v.number()),
    detected_name: v.optional(v.string()),
    detected_email: v.optional(v.string()),
    match_status: v.optional(v.string()),
    raw_text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    return await ctx.db.insert("candidateFiles", {
      ...args,
      match_status: args.match_status || "unmatched",
      created_at: Date.now(),
    });
  },
});
