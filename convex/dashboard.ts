import { query } from "./_generated/server";

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allCandidates = await ctx.db.query("candidates").collect();
    const allJobs = await ctx.db.query("jobs").collect();
    const allApplications = await ctx.db.query("applications").collect();
    const allInterviews = await ctx.db.query("interviews").collect();

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Stats
    const totalCandidates = allCandidates.length;
    const newThisWeek = allCandidates.filter(c => c.created_at >= weekAgo).length;
    const interviewsScheduled = allInterviews.filter(i =>
      i.scheduled_at && i.scheduled_at >= now && !i.outcome
    ).length;
    const approvedThisMonth = allCandidates.filter(c =>
      c.status === "approved" && c.updated_at >= monthAgo
    ).length;

    // Pipeline by status
    const statusCounts: Record<string, number> = {};
    allCandidates.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });
    const pipelineByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // Top jobs
    const topJobs = await Promise.all(
      allJobs.slice(0, 10).map(async (job) => {
        const apps = allApplications.filter(a => a.job_id === job._id);
        const scores = apps.map(a => a.ai_score).filter((s): s is number => s != null);
        return {
          id: job._id,
          title: job.title,
          candidate_count: apps.length,
          top_score: scores.length > 0 ? Math.max(...scores) : null,
        };
      })
    );

    // Recent activity
    const recentActivity = await ctx.db
      .query("activityLog")
      .withIndex("by_created_at")
      .order("desc")
      .take(20);

    const enrichedActivity = await Promise.all(
      recentActivity.map(async (a) => {
        const candidate = await ctx.db.get(a.candidate_id);
        return { ...a, candidate };
      })
    );

    return {
      total_candidates: totalCandidates,
      new_this_week: newThisWeek,
      interviews_scheduled: interviewsScheduled,
      approved_this_month: approvedThisMonth,
      pipeline_by_status: pipelineByStatus,
      top_jobs: topJobs,
      recent_activity: enrichedActivity,
    };
  },
});

export const getProfessionAnalysis = query({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    const categories = await ctx.db
      .query("jobCategories")
      .withIndex("by_sort_order")
      .collect();

    const analysis = categories.map((cat) => {
      const matching = candidates.filter(c =>
        (c.job_categories || []).includes(cat.key)
      );

      const avgExp = matching.length > 0
        ? matching.reduce((sum, c) => sum + (c.experience_years || 0), 0) / matching.length
        : 0;

      const skillCounts: Record<string, number> = {};
      matching.forEach(c => {
        (c.skills || []).forEach(sk => {
          skillCounts[sk] = (skillCounts[sk] || 0) + 1;
        });
      });
      const topSkills = Object.entries(skillCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([skill, count]) => ({ skill, count }));

      const statusBreakdown: Record<string, number> = {};
      matching.forEach(c => {
        statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;
      });

      return {
        key: cat.key,
        name_en: cat.name_en,
        name_he: cat.name_he,
        count: matching.length,
        avg_experience: Math.round(avgExp * 10) / 10,
        top_skills: topSkills,
        status_breakdown: statusBreakdown,
        with_portfolio: matching.filter(c => c.has_portfolio).length,
      };
    });

    return analysis.filter(a => a.count > 0).sort((a, b) => b.count - a.count);
  },
});
