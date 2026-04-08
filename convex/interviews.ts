import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const interviews = await ctx.db
      .query("interviews")
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      interviews.map(async (interview) => {
        const application = await ctx.db.get(interview.application_id);
        if (!application) return { ...interview, application: null };

        const candidate = await ctx.db.get(application.candidate_id);
        const job = await ctx.db.get(application.job_id);

        return {
          ...interview,
          application: {
            ...application,
            candidate,
            job,
          },
        };
      })
    );

    return enriched;
  },
});

export const create = mutation({
  args: {
    application_id: v.id("applications"),
    scheduled_at: v.optional(v.number()),
    duration_minutes: v.optional(v.number()),
    interviewer: v.optional(v.string()),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("interviews", {
      ...args,
      duration_minutes: args.duration_minutes || 60,
      type: args.type || "in-person",
      created_at: Date.now(),
    });

    // Update candidate status to interview_scheduled
    const application = await ctx.db.get(args.application_id);
    if (application) {
      await ctx.db.patch(application.candidate_id, {
        status: "interview_scheduled",
        updated_at: Date.now(),
      });

      await ctx.db.insert("activityLog", {
        candidate_id: application.candidate_id,
        action: "interview_scheduled",
        details: { type: args.type || "in-person", interviewer: args.interviewer },
        created_at: Date.now(),
      });
    }

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("interviews"),
    scheduled_at: v.optional(v.number()),
    duration_minutes: v.optional(v.number()),
    interviewer: v.optional(v.string()),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
    outcome: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    // If outcome is set, update candidate status
    if (updates.outcome) {
      const interview = await ctx.db.get(id);
      if (interview) {
        const application = await ctx.db.get(interview.application_id);
        if (application) {
          const newStatus = updates.outcome === "passed" ? "interviewed" : "rejected";
          await ctx.db.patch(application.candidate_id, {
            status: newStatus,
            updated_at: Date.now(),
          });

          await ctx.db.insert("activityLog", {
            candidate_id: application.candidate_id,
            action: "interview_completed",
            details: { outcome: updates.outcome },
            created_at: Date.now(),
          });
        }
      }
    }

    return id;
  },
});
