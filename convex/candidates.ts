import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireModule, requireWriteAccess, requirePermission } from "./lib/auth";

export const list = query({
  args: {
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    category: v.optional(v.string()),
    contactStatus: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    const limit = args.limit || 20;

    let q = ctx.db.query("candidates").order("desc");

    if (args.status) {
      q = ctx.db.query("candidates")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc");
    }

    const candidates = await q.take(limit + 1);

    // Apply in-memory filters for complex conditions
    let filtered = candidates;

    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(c =>
        c.full_name.toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s)
      );
    }

    if (args.category) {
      filtered = filtered.filter(c =>
        (c.job_categories || []).includes(args.category!)
      );
    }

    if (args.contactStatus) {
      filtered = filtered.filter(c => c.contact_status === args.contactStatus);
    }

    // Enrich with applications
    const result = await Promise.all(
      filtered.slice(0, limit).map(async (c) => {
        const applications = await ctx.db
          .query("applications")
          .withIndex("by_candidate", (q) => q.eq("candidate_id", c._id))
          .collect();

        const enrichedApps = await Promise.all(
          applications.map(async (app) => {
            const job = await ctx.db.get(app.job_id);
            return { ...app, job };
          })
        );

        return { ...c, applications: enrichedApps };
      })
    );

    return {
      candidates: result,
      total: filtered.length,
    };
  },
});

export const getById = query({
  args: { id: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    const candidate = await ctx.db.get(args.id);
    if (!candidate) return null;

    // Fetch related data
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();

    const enrichedApps = await Promise.all(
      applications.map(async (app) => {
        const job = await ctx.db.get(app.job_id);
        const interviews = await ctx.db
          .query("interviews")
          .withIndex("by_application", (q) => q.eq("application_id", app._id))
          .collect();
        return { ...app, job, interviews };
      })
    );

    const activityLog = await ctx.db
      .query("activityLog")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .order("desc")
      .take(50);

    const messages = await ctx.db
      .query("messagesSent")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();

    const files = await ctx.db
      .query("candidateFiles")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();

    return {
      ...candidate,
      applications: enrichedApps,
      activity_log: activityLog,
      messages_sent: messages,
      files,
    };
  },
});

export const create = mutation({
  args: {
    full_name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    linkedin_url: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience_years: v.optional(v.number()),
    education: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    previous_roles: v.optional(v.array(v.object({
      title: v.string(),
      company: v.string(),
      duration: v.string(),
      description: v.string(),
    }))),
    notes: v.optional(v.string()),
    source: v.optional(v.string()),
    job_categories: v.optional(v.array(v.string())),
    custom_category: v.optional(v.string()),
    classification_confidence: v.optional(v.number()),
    cv_raw_text: v.optional(v.string()),
    cv_storage_id: v.optional(v.id("_storage")),
    cv_file_url: v.optional(v.string()),
    ai_analysis: v.optional(v.any()),
    overall_ai_score: v.optional(v.number()),
    job_id: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    const now = Date.now();
    const id = await ctx.db.insert("candidates", {
      ...args,
      status: "new",
      source: args.source || "manual",
      created_at: now,
      updated_at: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      candidate_id: id,
      action: "candidate_created",
      details: { source: args.source || "manual" },
      created_at: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("candidates"),
    full_name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    linkedin_url: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience_years: v.optional(v.number()),
    education: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    previous_roles: v.optional(v.array(v.object({
      title: v.string(),
      company: v.string(),
      duration: v.string(),
      description: v.string(),
    }))),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
    job_categories: v.optional(v.array(v.string())),
    custom_category: v.optional(v.string()),
    classification_confidence: v.optional(v.number()),
    ai_analysis: v.optional(v.any()),
    overall_ai_score: v.optional(v.number()),
    contact_status: v.optional(v.string()),
    documents: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(),
      uploaded_at: v.string(),
      storageId: v.optional(v.id("_storage")),
    }))),
  },
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx, "recruitment");
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Candidate not found");

    await ctx.db.patch(id, {
      ...updates,
      updated_at: Date.now(),
    });

    // Log status change
    if (updates.status && updates.status !== existing.status) {
      await ctx.db.insert("activityLog", {
        candidate_id: id,
        action: "status_changed",
        details: { from: existing.status, to: updates.status },
        created_at: Date.now(),
      });
    }

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("candidates") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "delete_candidates");
    // Delete related records
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();

    for (const app of apps) {
      const interviews = await ctx.db
        .query("interviews")
        .withIndex("by_application", (q) => q.eq("application_id", app._id))
        .collect();
      for (const interview of interviews) {
        await ctx.db.delete(interview._id);
      }
      await ctx.db.delete(app._id);
    }

    const logs = await ctx.db
      .query("activityLog")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();
    for (const log of logs) await ctx.db.delete(log._id);

    const messages = await ctx.db
      .query("messagesSent")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();
    for (const msg of messages) await ctx.db.delete(msg._id);

    const files = await ctx.db
      .query("candidateFiles")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.id))
      .collect();
    for (const file of files) await ctx.db.delete(file._id);

    await ctx.db.delete(args.id);
  },
});

export const bulkDelete = mutation({
  args: { ids: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "delete_candidates");
    for (const id of args.ids) {
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidate", (q) => q.eq("candidate_id", id))
        .collect();
      for (const app of apps) {
        const interviews = await ctx.db
          .query("interviews")
          .withIndex("by_application", (q) => q.eq("application_id", app._id))
          .collect();
        for (const i of interviews) await ctx.db.delete(i._id);
        await ctx.db.delete(app._id);
      }

      const logs = await ctx.db.query("activityLog").withIndex("by_candidate", (q) => q.eq("candidate_id", id)).collect();
      for (const l of logs) await ctx.db.delete(l._id);

      const msgs = await ctx.db.query("messagesSent").withIndex("by_candidate", (q) => q.eq("candidate_id", id)).collect();
      for (const m of msgs) await ctx.db.delete(m._id);

      const files = await ctx.db.query("candidateFiles").withIndex("by_candidate", (q) => q.eq("candidate_id", id)).collect();
      for (const f of files) await ctx.db.delete(f._id);

      await ctx.db.delete(id);
    }
  },
});

export const search = query({
  args: {
    search: v.optional(v.string()),
    statuses: v.optional(v.array(v.string())),
    professions: v.optional(v.array(v.string())),
    min_experience: v.optional(v.number()),
    max_experience: v.optional(v.number()),
    min_score: v.optional(v.number()),
    max_score: v.optional(v.number()),
    has_portfolio: v.optional(v.boolean()),
    has_email: v.optional(v.boolean()),
    has_phone: v.optional(v.boolean()),
    required_skills: v.optional(v.array(v.string())),
    sort_by: v.optional(v.string()),
    sort_order: v.optional(v.string()),
    page: v.optional(v.number()),
    per_page: v.optional(v.number()),
    preset: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    const page = args.page || 1;
    const perPage = args.per_page || 50;

    let allCandidates = await ctx.db.query("candidates").order("desc").collect();

    // Apply preset filters
    if (args.preset === "new_this_week") {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      allCandidates = allCandidates.filter(c => c.created_at >= weekAgo);
    }
    if (args.preset === "strong_candidates") {
      allCandidates = allCandidates.filter(c => (c.overall_ai_score || 0) >= 75);
    }
    if (args.preset === "ready_for_interview") {
      allCandidates = allCandidates.filter(c => ["shortlisted", "reviewed"].includes(c.status));
    }
    if (args.preset === "with_portfolio") {
      allCandidates = allCandidates.filter(c => c.has_portfolio === true);
    }

    // Text search
    if (args.search?.trim()) {
      const s = args.search.toLowerCase();
      allCandidates = allCandidates.filter(c =>
        c.full_name.toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s)
      );
    }

    // Filters
    if (args.statuses && args.statuses.length > 0) {
      allCandidates = allCandidates.filter(c => args.statuses!.includes(c.status));
    }
    if (args.professions && args.professions.length > 0) {
      allCandidates = allCandidates.filter(c =>
        (c.job_categories || []).some(cat => args.professions!.includes(cat))
      );
    }
    if (args.min_experience != null) {
      allCandidates = allCandidates.filter(c => (c.experience_years || 0) >= args.min_experience!);
    }
    if (args.max_experience != null) {
      allCandidates = allCandidates.filter(c => (c.experience_years || 0) <= args.max_experience!);
    }
    if (args.min_score != null) {
      allCandidates = allCandidates.filter(c => (c.overall_ai_score || 0) >= args.min_score!);
    }
    if (args.max_score != null) {
      allCandidates = allCandidates.filter(c => (c.overall_ai_score || 0) <= args.max_score!);
    }
    if (args.has_portfolio === true) {
      allCandidates = allCandidates.filter(c => c.has_portfolio === true);
    }
    if (args.has_email === true) {
      allCandidates = allCandidates.filter(c => !!c.email);
    }
    if (args.has_phone === true) {
      allCandidates = allCandidates.filter(c => !!c.phone);
    }
    if (args.required_skills && args.required_skills.length > 0) {
      allCandidates = allCandidates.filter(c =>
        args.required_skills!.every(sk => (c.skills || []).includes(sk))
      );
    }

    // Sort
    const sortBy = args.sort_by || "created_at";
    const asc = args.sort_order === "asc";
    allCandidates.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortBy === "full_name") { va = a.full_name; vb = b.full_name; }
      else if (sortBy === "experience_years") { va = a.experience_years || 0; vb = b.experience_years || 0; }
      else if (sortBy === "overall_ai_score") { va = a.overall_ai_score || 0; vb = b.overall_ai_score || 0; }
      else { va = a.created_at; vb = b.created_at; }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });

    const total = allCandidates.length;
    const from = (page - 1) * perPage;
    const paged = allCandidates.slice(from, from + perPage);

    // Enrich with applications
    const result = await Promise.all(
      paged.map(async (c) => {
        const applications = await ctx.db
          .query("applications")
          .withIndex("by_candidate", (q) => q.eq("candidate_id", c._id))
          .collect();
        const enrichedApps = await Promise.all(
          applications.map(async (app) => {
            const job = await ctx.db.get(app.job_id);
            return { ...app, job };
          })
        );
        return { ...c, applications: enrichedApps };
      })
    );

    return {
      candidates: result,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    };
  },
});

export const getFiles = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    return await ctx.db
      .query("candidateFiles")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.candidateId))
      .collect();
  },
});

export const getMessages = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireModule(ctx, "recruitment");
    return await ctx.db
      .query("messagesSent")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.candidateId))
      .collect();
  },
});
