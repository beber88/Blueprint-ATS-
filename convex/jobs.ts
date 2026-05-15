import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireModule, requireWriteAccess } from "./lib/auth";

export const list = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    let jobs;
    if (args.status) {
      jobs = await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      jobs = await ctx.db.query("jobs").order("desc").collect();
    }

    // Enrich with candidate counts and top scores
    const enriched = await Promise.all(
      jobs.map(async (job) => {
        const applications = await ctx.db
          .query("applications")
          .withIndex("by_job", (q) => q.eq("job_id", job._id))
          .collect();

        const scores = applications.map(a => a.ai_score).filter((s): s is number => s != null);
        return {
          ...job,
          candidate_count: applications.length,
          top_score: scores.length > 0 ? Math.max(...scores) : null,
          avg_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        };
      })
    );

    return enriched;
  },
});

export const getById = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    const job = await ctx.db.get(args.id);
    if (!job) return null;

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("job_id", args.id))
      .collect();

    const enrichedApps = await Promise.all(
      applications.map(async (app) => {
        const candidate = await ctx.db.get(app.candidate_id);
        return { ...app, candidate };
      })
    );

    const requirements = await ctx.db
      .query("jobRequirements")
      .withIndex("by_job", (q) => q.eq("job_id", args.id))
      .first();

    return {
      ...job,
      applications: enrichedApps,
      requirements,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    department: v.optional(v.string()),
    description: v.optional(v.string()),
    requirements: v.optional(v.string()),
    location: v.optional(v.string()),
    employment_type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    const now = Date.now();
    return await ctx.db.insert("jobs", {
      ...args,
      status: "active",
      employment_type: args.employment_type || "full-time",
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("jobs"),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    description: v.optional(v.string()),
    requirements: v.optional(v.string()),
    location: v.optional(v.string()),
    employment_type: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return id;
  },
});

export const getMatches = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("job_id", args.jobId))
      .collect();

    const enriched = await Promise.all(
      applications.map(async (app) => {
        const candidate = await ctx.db.get(app.candidate_id);
        return { ...app, candidate };
      })
    );

    // Sort by AI score descending
    enriched.sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));

    return enriched;
  },
});
